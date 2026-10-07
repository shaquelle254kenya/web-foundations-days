# Reflection

## The most difficult concept and how I overcame it

The hardest part for me was thinking in systems instead of just writing code. Deciding where a cache, a read replica or a queue belongs felt abstract at first. What helped was working with real numbers. Turning 1 million users into about 10 writes and 500 reads per second showed me the system was read-heavy, and that explained why a cache and a replica matter. Async JavaScript and `fetch` also confused me until I built the QuickNotes API client and watched the loading, success and error states work with my own code. Building everything step by step, one small commit at a time, helped me understand each part instead of rushing.

## What I would improve in my capstone

Based on the feedback I received, I would make my architecture explanation clearer and go deeper on failure cases, such as what happens if the primary database fails during peak traffic. I would also explain my estimates more slowly, showing each calculation and why I chose it, so a listener can follow my reasoning without needing the document in front of them.

## What I will learn next

Next I want to build a real backend with Node.js and a database, so QuickNotes has its own working API instead of using JSONPlaceholder. After that I want to learn authentication, so users can log in securely, and how to deploy an app online so real people can use it.
