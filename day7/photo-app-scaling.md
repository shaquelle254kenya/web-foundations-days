# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow.

## Assumptions

- 10 million registered users
- 10% are active each day
- Each active user uploads 1 photo per day
- Each active user views 50 feed pages per day
- Average photo: 2 MB. Each photo also gets a 50 KB thumbnail
- One day is about 100,000 seconds (rounded for easy estimates)
- Peak traffic is 5x the average

## Daily active users

10,000,000 x 10% = **1,000,000 daily active users (DAU)**

## Estimates

### Uploads per second
- Uploads per day: 1,000,000 users x 1 photo = 1,000,000
- Average: 1,000,000 / 100,000 = **10 uploads per second**
- Peak (5x): **50 uploads per second**

### Feed views per second
- Feed views per day: 1,000,000 users x 50 = 50,000,000
- Average: 50,000,000 / 100,000 = **500 feed views per second**
- Peak (5x): **2,500 feed views per second**

### Photo storage per year
- Per photo: 2 MB + 50 KB thumbnail = about 2.05 MB
- Per day: 1,000,000 x 2.05 MB = about 2.05 TB
- Per year: 2.05 TB x 365 = about **750 TB (roughly 0.75 PB)**
  - Originals: about 730 TB
  - Thumbnails: about 18 TB

## Read-heavy or write-heavy?

SnapShare is **read-heavy**. Users view 500 feed pages per second but upload only 10 photos per second, so reads outnumber writes about 50 to 1.

What this means for the design:
- Make reads cheap and fast: use a CDN and a cache so most requests never reach the database.
- Add a read replica so feed queries do not slow down the main database.
- Keep writes simple and reliable, and move slow work (like thumbnails) to the background.
- Scale the read side first, because that is where the traffic is.

## Why photos should not be stored in the database

Photos are large files (2 MB each, about 750 TB per year). Storing them in the database would make it huge, slow, expensive to back up, and hard to scale, and every photo download would use up database capacity that should serve queries. Photos belong in **object storage** (like Amazon S3). The database stores only small metadata: the photo id, the owner, the caption, the time, and the storage URL of the file.

## Architecture diagram

    [ Users: phones and browsers ]
                 |
                 v
          +-------------+   serves photos & thumbnails
          |     CDN     | <------------------------------+
          +------+------+                                |
                 | API requests                          |
                 v                                       |
        +-----------------+                     +--------+---------+
        |  Load Balancer  |                     |  Object Storage  |
        +--------+--------+                     | (photos, thumbs) |
                 |                              +---+----------+---+
        +--------+--------+                         ^          ^
        v                 v                         |          |
    +----------+     +----------+   upload original |          | save thumbnail
    | App      |     | App      |-------------------+          |
    | Server 1 |     | Server 2 |                              |
    +--+---+---+     +--+---+---+                       +------+------+
       |   |            |   |      enqueue job          |   Worker    |
       |   +------------+---+-----> [ Queue ] --------> | (thumbnail) |
       |                |                               +-------------+
       v                v
    +---------+    +----------------------+
    |  Cache  |    |  Database (primary)  |--replicates--> [ Read Replica ]
    | (Redis) |    |  users, photo info   |                 (feed reads)
    +---------+    +----------------------+

## Components (one sentence each)

- **CDN:** serves photos, thumbnails, CSS and JavaScript from servers close to users, so loading is fast and our servers carry less traffic.
- **Load balancer:** spreads incoming requests across many app servers so no single server is overloaded and one failure does not take the app down.
- **App servers:** run the SnapShare logic (login, upload, feed) and are stateless, so we can add more of them when traffic grows.
- **Cache (Redis):** keeps popular data such as users' feed lists in fast memory, so repeated reads do not hit the database.
- **Database (primary):** stores users, follows and photo metadata reliably, and handles all writes.
- **Read replica:** a live copy of the database that answers feed reads, so the primary is free to handle writes.
- **Object storage:** stores the photo and thumbnail files cheaply and almost without limit, with built-in durability.
- **Queue:** holds thumbnail jobs so the upload can finish right away instead of waiting for image processing.
- **Worker:** picks jobs from the queue, creates the 50 KB thumbnail and saves it to object storage.

## Upload flow (step by step)

1. The user picks a photo in the app and taps Upload.
2. The request goes through the CDN to the load balancer, which sends it to one app server.
3. The app server checks that the user is logged in and that the file is a valid image within the size limit.
4. The app server saves the original photo to object storage and gets back its URL.
5. The app server writes the photo's metadata (id, owner, URL, time, status "processing") to the primary database.
6. The app server adds a "create thumbnail" job to the queue and immediately tells the user the upload succeeded.
7. A worker takes the job from the queue, downloads the original from object storage and creates a 50 KB thumbnail.
8. The worker saves the thumbnail to object storage and marks the photo as "ready" in the database.
9. The app server clears or updates the cached feeds of the user's followers, so the new photo shows up.
10. Followers load the thumbnail through the CDN the next time they scroll their feed.

## Trade-offs

- **Caching vs fresh data:** the cache makes feeds fast and protects the database, but cached feeds can be a little out of date, and we must invalidate or update them when new photos arrive. We accept slightly stale feeds for much better speed.
- **Read replica lag:** the replica copies data from the primary with a small delay, so a user might not see their own new photo for a moment if their feed is read from the replica. Reads scale much better, but data is only eventually consistent.
- **Background thumbnails vs instant thumbnails:** using a queue makes uploads fast and lets us handle spikes, but the thumbnail appears a few seconds after the upload. We can show a placeholder meanwhile.
- **Cost of storage and CDN:** about 750 TB of new photos every year is expensive. We could compress photos, move old ones to cheaper storage, or limit sizes, trading some quality or access speed for lower cost.
