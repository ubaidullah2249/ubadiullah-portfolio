const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8088);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@ubaidullah.com.bd";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMeNow!2026";
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "site.json");
const sessions = new Set();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value = "") {
  const slug = String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || crypto.randomBytes(4).toString("hex");
}

function send(res, status, body, type = "text/html; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";
  return cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")[1];
}

function isAuthed(req) {
  const token = getCookie(req, "portfolio_session");
  return Boolean(token && sessions.has(token));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Object.fromEntries(new URLSearchParams(body))));
    req.on("error", reject);
  });
}

function publicLayout(data, title, body) {
  const profile = data.profile;
  return `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(profile.name)} - ${escapeHtml(profile.title)}" />
    <title>${escapeHtml(title)} | ${escapeHtml(profile.name)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell">
      <header class="site-header">
        <a class="brand" href="/"><span>MD</span> Ubaidullah</a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span></span><span></span></button>
        <nav class="site-nav" id="site-nav">
          <a href="/services">সেবা</a>
          <a href="/portfolio">কাজ</a>
          <a href="/blog">ব্লগ</a>
          <a href="/about">পরিচিতি</a>
          <a href="/contact">যোগাযোগ</a>
        </nav>
      </header>
      <main>${body}</main>
      <footer class="site-footer">
        <p>© ${new Date().getFullYear()} ${escapeHtml(profile.name)}. All rights reserved.</p>
        <a href="/admin">Admin</a>
      </footer>
    </div>
    <script src="/script.js"></script>
  </body>
</html>`;
}

function hero(data) {
  const profile = data.profile;
  return `<section class="hero">
    <div class="hero-content">
      <p class="eyebrow">Independent Digital Professional</p>
      <h1>${escapeHtml(profile.name)}</h1>
      <p class="hero-lead">${escapeHtml(profile.intro)}</p>
      <div class="hero-tags">
        <span>Web Development</span>
        <span>Video Editing</span>
        <span>Cyber Security</span>
      </div>
      <div class="hero-actions">
        <a class="button primary" href="/contact">কাজের জন্য যোগাযোগ</a>
        <a class="button ghost" href="/portfolio">কাজ দেখুন</a>
      </div>
    </div>
    <div class="hero-media">
      <img src="/assets/hero-md-ubaidullah.png" alt="Professional portfolio visual" />
      <div class="hero-badge"><strong>5+</strong><span>Professional skill areas</span></div>
    </div>
  </section>`;
}

function homePage(data) {
  const services = data.services.slice(0, 5).map((service, index) => `<article class="service-card">
    <span>${String(index + 1).padStart(2, "0")}</span>
    <h3>${escapeHtml(service.title)}</h3>
    <p>${escapeHtml(service.summary)}</p>
  </article>`).join("");

  const projects = data.projects.slice(0, 3).map((project) => `<article class="feature-card">
    <p class="eyebrow">${escapeHtml(project.category)}</p>
    <h3>${escapeHtml(project.title)}</h3>
    <p>${escapeHtml(project.summary)}</p>
    <a href="/portfolio/${encodeURIComponent(project.id)}">Case study</a>
  </article>`).join("");

  const posts = data.posts.filter((post) => post.published).slice(0, 3).map((post) => `<article class="feature-card">
    <p class="eyebrow">${escapeHtml(post.category)}</p>
    <h3>${escapeHtml(post.title)}</h3>
    <p>${escapeHtml(post.summary)}</p>
    <a href="/blog/${encodeURIComponent(post.id)}">পড়ুন</a>
  </article>`).join("");

  return publicLayout(data, "Home", `${hero(data)}
    <section class="stats">
      <div><strong>${data.services.length}+</strong><span>Service Area</span></div>
      <div><strong>${data.projects.length}+</strong><span>Project Entries</span></div>
      <div><strong>${data.posts.filter((post) => post.published).length}+</strong><span>Published Blogs</span></div>
      <div><strong>Admin</strong><span>Content Managed</span></div>
    </section>
    <section class="intro-strip">
      <p>Premium personal brand website with blog, portfolio, service pages and admin-controlled content.</p>
      <a href="/about">পরিচিতি জানুন</a>
    </section>
    <section class="section">
      <div class="section-heading"><p class="eyebrow">Services</p><h2>যে কাজগুলো করি</h2></div>
      <div class="service-grid">${services}</div>
    </section>
    <section class="work-band">
      <div class="section-heading"><p class="eyebrow">Featured Work</p><h2>নির্বাচিত কাজ</h2></div>
      <div class="feature-grid">${projects}</div>
    </section>
    <section class="section">
      <div class="section-heading"><p class="eyebrow">Blog</p><h2>লেখা ও রিসোর্স</h2></div>
      <div class="feature-grid">${posts}</div>
    </section>`);
}

function aboutPage(data) {
  const profile = data.profile;
  return publicLayout(data, "About", `<section class="split-section page-top">
    <div><p class="eyebrow">About</p><h2>ডিজিটাল কাজের জন্য বহুমুখী দক্ষতা</h2></div>
    <div class="about-copy"><p>${escapeHtml(profile.bio)}</p>
      <ul>
        <li>Portfolio, business এবং service website</li>
        <li>Content planning, video editing এবং media presentation</li>
        <li>Online safety, account protection এবং security awareness</li>
      </ul>
    </div>
  </section>`);
}

function servicesPage(data) {
  const services = data.services.map((service, index) => `<article class="service-card tall-card">
    <span>${String(index + 1).padStart(2, "0")}</span>
    <h3>${escapeHtml(service.title)}</h3>
    <p>${escapeHtml(service.summary)}</p>
    <p>${escapeHtml(service.details)}</p>
  </article>`).join("");
  return publicLayout(data, "Services", `<section class="section page-top">
    <div class="section-heading"><p class="eyebrow">Services</p><h2>Professional service menu</h2></div>
    <div class="service-grid">${services}</div>
  </section>`);
}

function portfolioPage(data) {
  const projects = data.projects.map((project) => `<article class="feature-card light">
    <p class="eyebrow">${escapeHtml(project.category)}</p>
    <h3>${escapeHtml(project.title)}</h3>
    <p>${escapeHtml(project.summary)}</p>
    <a href="/portfolio/${encodeURIComponent(project.id)}">বিস্তারিত</a>
  </article>`).join("");
  return publicLayout(data, "Portfolio", `<section class="section page-top">
    <div class="section-heading"><p class="eyebrow">Portfolio</p><h2>Project archive</h2></div>
    <div class="feature-grid">${projects}</div>
  </section>`);
}

function projectPage(data, id) {
  const project = data.projects.find((item) => item.id === id);
  if (!project) return null;
  return publicLayout(data, project.title, `<section class="article-page">
    <p class="eyebrow">${escapeHtml(project.category)}</p>
    <h1>${escapeHtml(project.title)}</h1>
    <p class="hero-lead">${escapeHtml(project.summary)}</p>
    <div class="article-body"><p>${escapeHtml(project.details)}</p>${project.url ? `<p><a href="${escapeHtml(project.url)}">Live link</a></p>` : ""}</div>
  </section>`);
}

function blogPage(data) {
  const posts = data.posts.filter((post) => post.published).map((post) => `<article class="feature-card light">
    <p class="eyebrow">${escapeHtml(post.category)} / ${escapeHtml(post.createdAt)}</p>
    <h3>${escapeHtml(post.title)}</h3>
    <p>${escapeHtml(post.summary)}</p>
    <a href="/blog/${encodeURIComponent(post.id)}">পড়ুন</a>
  </article>`).join("");
  return publicLayout(data, "Blog", `<section class="section page-top">
    <div class="section-heading"><p class="eyebrow">Blog</p><h2>লেখা, গাইড ও নোট</h2></div>
    <div class="feature-grid">${posts}</div>
  </section>`);
}

function postPage(data, id) {
  const post = data.posts.find((item) => item.id === id && item.published);
  if (!post) return null;
  return publicLayout(data, post.title, `<section class="article-page">
    <p class="eyebrow">${escapeHtml(post.category)} / ${escapeHtml(post.createdAt)}</p>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="hero-lead">${escapeHtml(post.summary)}</p>
    <div class="article-body">${escapeHtml(post.content).split("\n").map((line) => `<p>${line}</p>`).join("")}</div>
  </section>`);
}

function contactPage(data, sent = false) {
  const profile = data.profile;
  return publicLayout(data, "Contact", `<section class="contact-section page-top">
    <div>
      <p class="eyebrow">Contact</p>
      <h2>নতুন project নিয়ে কথা বলা যাক</h2>
      <p>আপনার website, video, media content বা cyber security বিষয়ে সাহায্য দরকার হলে যোগাযোগ করুন।</p>
      ${sent ? `<p class="success-note">ধন্যবাদ। আপনার message save হয়েছে।</p>` : ""}
    </div>
    <form class="contact-form" action="/contact" method="post">
      <label>নাম <input type="text" name="name" required /></label>
      <label>ইমেইল <input type="email" name="email" required /></label>
      <label>ফোন <input type="text" name="phone" /></label>
      <label>বার্তা <textarea name="message" rows="5" required></textarea></label>
      <button class="button primary" type="submit">বার্তা পাঠান</button>
      <a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>
    </form>
  </section>`);
}

function adminLayout(title, body) {
  return `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Admin</title>
    <link rel="stylesheet" href="/admin.css" />
  </head>
  <body>
    <aside class="admin-sidebar">
      <a class="admin-brand" href="/admin/dashboard">Ubaidullah Admin</a>
      <nav>
        <a href="/admin/dashboard">Dashboard</a>
        <a href="/admin/posts">Blog</a>
        <a href="/admin/projects">Portfolio</a>
        <a href="/admin/services">Services</a>
        <a href="/admin/messages">Messages</a>
        <a href="/admin/settings">Settings</a>
        <a href="/">View site</a>
      </nav>
      <form action="/admin/logout" method="post"><button type="submit">Logout</button></form>
    </aside>
    <main class="admin-main">${body}</main>
  </body>
</html>`;
}

function loginPage(message = "") {
  return `<!doctype html>
<html lang="bn">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Admin Login</title><link rel="stylesheet" href="/admin.css" /></head>
  <body class="login-body">
    <form class="login-card" action="/admin/login" method="post">
      <p class="eyebrow">Admin</p>
      <h1>Sign in</h1>
      ${message ? `<p class="error-note">${escapeHtml(message)}</p>` : ""}
      <label>Email <input type="email" name="email" required /></label>
      <label>Password <input type="password" name="password" required /></label>
      <button type="submit">Login</button>
    </form>
  </body>
</html>`;
}

function dashboardPage(data) {
  return adminLayout("Dashboard", `<header class="admin-header"><div><p class="eyebrow">Dashboard</p><h1>Content overview</h1></div></header>
    <section class="metric-grid">
      <div><strong>${data.posts.length}</strong><span>Blog posts</span></div>
      <div><strong>${data.projects.length}</strong><span>Projects</span></div>
      <div><strong>${data.services.length}</strong><span>Services</span></div>
      <div><strong>${data.messages.length}</strong><span>Messages</span></div>
    </section>`);
}

function textInput(name, label, value = "", type = "text") {
  return `<label>${label}<input type="${type}" name="${name}" value="${escapeHtml(value)}" /></label>`;
}

function textArea(name, label, value = "") {
  return `<label>${label}<textarea name="${name}" rows="7">${escapeHtml(value)}</textarea></label>`;
}

function adminListPage(kind, title, items) {
  const rows = items.map((item) => `<tr>
    <td><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category || item.summary || "")}</span></td>
    <td><a href="/admin/${kind}/${encodeURIComponent(item.id)}/edit">Edit</a></td>
    <td><form action="/admin/${kind}/${encodeURIComponent(item.id)}/delete" method="post"><button class="danger" type="submit">Delete</button></form></td>
  </tr>`).join("");
  return adminLayout(title, `<header class="admin-header"><div><p class="eyebrow">Manage</p><h1>${escapeHtml(title)}</h1></div><a class="admin-action" href="/admin/${kind}/new">Add new</a></header>
    <table class="admin-table"><tbody>${rows || `<tr><td>No entries yet.</td></tr>`}</tbody></table>`);
}

function adminEditor(kind, title, item = {}) {
  const isPost = kind === "posts";
  const isProject = kind === "projects";
  const action = item.id ? `/admin/${kind}/${encodeURIComponent(item.id)}/edit` : `/admin/${kind}/new`;
  return adminLayout(title, `<header class="admin-header"><div><p class="eyebrow">Editor</p><h1>${escapeHtml(title)}</h1></div></header>
    <form class="admin-form" action="${action}" method="post">
      ${textInput("title", "Title", item.title)}
      ${textInput("category", "Category", item.category)}
      ${textArea("summary", "Summary", item.summary)}
      ${textArea(isProject ? "details" : "content", isProject ? "Details" : "Content", isProject ? item.details : item.content)}
      ${isProject ? textInput("url", "URL", item.url || "") : ""}
      ${isPost ? `<label class="check-row"><input type="checkbox" name="published" ${item.published !== false ? "checked" : ""} /> Published</label>` : ""}
      <button type="submit">Save</button>
    </form>`);
}

function servicesAdmin(data) {
  const cards = data.services.map((service) => `<article class="admin-card">
    <h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.summary)}</p>
    <a href="/admin/services/${encodeURIComponent(service.id)}/edit">Edit</a>
  </article>`).join("");
  return adminLayout("Services", `<header class="admin-header"><div><p class="eyebrow">Manage</p><h1>Services</h1></div><a class="admin-action" href="/admin/services/new">Add new</a></header><section class="admin-grid">${cards}</section>`);
}

function serviceEditor(item = {}) {
  const action = item.id ? `/admin/services/${encodeURIComponent(item.id)}/edit` : "/admin/services/new";
  return adminLayout("Service Editor", `<header class="admin-header"><div><p class="eyebrow">Editor</p><h1>Service</h1></div></header>
    <form class="admin-form" action="${action}" method="post">
      ${textInput("title", "Title", item.title)}
      ${textArea("summary", "Summary", item.summary)}
      ${textArea("details", "Details", item.details)}
      <button type="submit">Save</button>
    </form>`);
}

function messagesPage(data) {
  const rows = data.messages.slice().reverse().map((message) => `<tr>
    <td><strong>${escapeHtml(message.name)}</strong><span>${escapeHtml(message.email)} ${escapeHtml(message.phone || "")}</span></td>
    <td>${escapeHtml(message.message)}</td>
    <td>${escapeHtml(message.createdAt)}</td>
  </tr>`).join("");
  return adminLayout("Messages", `<header class="admin-header"><div><p class="eyebrow">Inbox</p><h1>Contact messages</h1></div></header><table class="admin-table"><tbody>${rows || `<tr><td>No messages yet.</td></tr>`}</tbody></table>`);
}

function settingsPage(data) {
  const profile = data.profile;
  return adminLayout("Settings", `<header class="admin-header"><div><p class="eyebrow">Profile</p><h1>Site settings</h1></div></header>
    <form class="admin-form" action="/admin/settings" method="post">
      ${textInput("name", "Name", profile.name)}
      ${textInput("title", "Title", profile.title)}
      ${textArea("intro", "Intro", profile.intro)}
      ${textArea("bio", "Bio", profile.bio)}
      ${textInput("email", "Email", profile.email, "email")}
      ${textInput("phone", "Phone", profile.phone)}
      ${textInput("location", "Location", profile.location)}
      ${textInput("facebook", "Facebook", profile.facebook)}
      ${textInput("linkedin", "LinkedIn", profile.linkedin)}
      ${textInput("github", "GitHub", profile.github)}
      ${textInput("youtube", "YouTube", profile.youtube)}
      <button type="submit">Save settings</button>
    </form>`);
}

function serveAsset(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(ROOT, safePath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return true;
  }
  const ext = path.extname(file);
  send(res, 200, fs.readFileSync(file), contentTypes[ext] || "application/octet-stream");
  return true;
}

async function handleAdmin(req, res, pathname) {
  if (pathname === "/admin/login" && req.method === "POST") {
    const body = await parseBody(req);
    if (body.email === ADMIN_EMAIL && body.password === ADMIN_PASSWORD) {
      const token = crypto.randomBytes(24).toString("hex");
      sessions.add(token);
      res.writeHead(303, {
        Location: "/admin/dashboard",
        "Set-Cookie": `portfolio_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
      });
      res.end();
      return;
    }
    send(res, 401, loginPage("Invalid login."));
    return;
  }

  if (pathname === "/admin" || pathname === "/admin/login") {
    if (isAuthed(req)) redirect(res, "/admin/dashboard");
    else send(res, 200, loginPage());
    return;
  }

  if (!isAuthed(req)) {
    redirect(res, "/admin/login");
    return;
  }

  if (pathname === "/admin/logout" && req.method === "POST") {
    const token = getCookie(req, "portfolio_session");
    sessions.delete(token);
    res.writeHead(303, {
      Location: "/admin/login",
      "Set-Cookie": "portfolio_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    });
    res.end();
    return;
  }

  const data = readData();
  if (pathname === "/admin/dashboard") return send(res, 200, dashboardPage(data));
  if (pathname === "/admin/messages") return send(res, 200, messagesPage(data));
  if (pathname === "/admin/settings" && req.method === "GET") return send(res, 200, settingsPage(data));
  if (pathname === "/admin/settings" && req.method === "POST") {
    data.profile = { ...data.profile, ...(await parseBody(req)) };
    writeData(data);
    return redirect(res, "/admin/settings");
  }
  if (pathname === "/admin/services") return send(res, 200, servicesAdmin(data));

  for (const kind of ["posts", "projects"]) {
    if (pathname === `/admin/${kind}`) return send(res, 200, adminListPage(kind, kind === "posts" ? "Blog posts" : "Portfolio projects", data[kind]));
    if (pathname === `/admin/${kind}/new` && req.method === "GET") return send(res, 200, adminEditor(kind, "New entry"));
    if (pathname === `/admin/${kind}/new` && req.method === "POST") {
      const body = await parseBody(req);
      const title = body.title || "Untitled";
      data[kind].unshift({
        id: slugify(title),
        title,
        category: body.category || "",
        summary: body.summary || "",
        content: body.content || "",
        details: body.details || "",
        url: body.url || "",
        published: body.published === "on",
        createdAt: new Date().toISOString().slice(0, 10)
      });
      writeData(data);
      return redirect(res, `/admin/${kind}`);
    }
    const editMatch = pathname.match(new RegExp(`^/admin/${kind}/([^/]+)/edit$`));
    if (editMatch) {
      const item = data[kind].find((entry) => entry.id === decodeURIComponent(editMatch[1]));
      if (!item) return send(res, 404, "Not found");
      if (req.method === "GET") return send(res, 200, adminEditor(kind, `Edit ${item.title}`, item));
      const body = await parseBody(req);
      Object.assign(item, body, { published: kind === "posts" ? body.published === "on" : item.published });
      writeData(data);
      return redirect(res, `/admin/${kind}`);
    }
    const deleteMatch = pathname.match(new RegExp(`^/admin/${kind}/([^/]+)/delete$`));
    if (deleteMatch && req.method === "POST") {
      data[kind] = data[kind].filter((entry) => entry.id !== decodeURIComponent(deleteMatch[1]));
      writeData(data);
      return redirect(res, `/admin/${kind}`);
    }
  }

  if (pathname === "/admin/services/new" && req.method === "GET") return send(res, 200, serviceEditor());
  if (pathname === "/admin/services/new" && req.method === "POST") {
    const body = await parseBody(req);
    data.services.push({ id: slugify(body.title), title: body.title, summary: body.summary, details: body.details });
    writeData(data);
    return redirect(res, "/admin/services");
  }
  const serviceMatch = pathname.match(/^\/admin\/services\/([^/]+)\/edit$/);
  if (serviceMatch) {
    const item = data.services.find((entry) => entry.id === decodeURIComponent(serviceMatch[1]));
    if (!item) return send(res, 404, "Not found");
    if (req.method === "GET") return send(res, 200, serviceEditor(item));
    Object.assign(item, await parseBody(req));
    writeData(data);
    return redirect(res, "/admin/services");
  }

  send(res, 404, "Admin page not found");
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname).replace(/\/$/, "") || "/";

  try {
    if (pathname.startsWith("/assets/") || pathname === "/styles.css" || pathname === "/script.js" || pathname === "/admin.css") {
      return serveAsset(req, res, pathname);
    }
    if (pathname.startsWith("/admin")) return await handleAdmin(req, res, pathname);

    const data = readData();
    if (pathname === "/") return send(res, 200, homePage(data));
    if (pathname === "/about") return send(res, 200, aboutPage(data));
    if (pathname === "/services") return send(res, 200, servicesPage(data));
    if (pathname === "/portfolio") return send(res, 200, portfolioPage(data));
    if (pathname.startsWith("/portfolio/")) {
      const page = projectPage(data, pathname.split("/").pop());
      return page ? send(res, 200, page) : send(res, 404, publicLayout(data, "Not found", `<section class="article-page"><h1>Project not found</h1></section>`));
    }
    if (pathname === "/blog") return send(res, 200, blogPage(data));
    if (pathname.startsWith("/blog/")) {
      const page = postPage(data, pathname.split("/").pop());
      return page ? send(res, 200, page) : send(res, 404, publicLayout(data, "Not found", `<section class="article-page"><h1>Post not found</h1></section>`));
    }
    if (pathname === "/contact" && req.method === "GET") return send(res, 200, contactPage(data, url.searchParams.get("sent") === "1"));
    if (pathname === "/contact" && req.method === "POST") {
      const body = await parseBody(req);
      data.messages.push({
        id: crypto.randomBytes(6).toString("hex"),
        name: body.name || "",
        email: body.email || "",
        phone: body.phone || "",
        message: body.message || "",
        createdAt: new Date().toISOString()
      });
      writeData(data);
      return redirect(res, "/contact?sent=1");
    }
    send(res, 404, publicLayout(data, "Not found", `<section class="article-page"><h1>Page not found</h1></section>`));
  } catch (error) {
    console.error(error);
    send(res, 500, "Server error", "text/plain; charset=utf-8");
  }
}

http.createServer(handle).listen(PORT, "0.0.0.0", () => {
  console.log(`Portfolio app running on ${PORT}`);
});
