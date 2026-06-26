# MD Ubaidullah Portfolio

Professional Bangla portfolio website for `ubaidullah.com.bd` with a lightweight Node.js admin panel.

## Features

- Public pages: Home, About, Services, Portfolio, Blog, Contact
- Admin panel: Dashboard, Blog posts, Projects, Services, Messages, Settings
- Persistent JSON content store at `data/site.json`
- No external npm dependencies

## Run

```bash
PORT=8088 \
ADMIN_EMAIL=admin@ubaidullah.com.bd \
ADMIN_PASSWORD=change-this-password \
node server.js
```

## Admin

Visit `/admin` and sign in with the configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
