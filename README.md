# vlasov.ca

Eugene Vlasov’s static personal homepage: science, computers, hardware, teaching, experiments, and School of Code Calgary.

The production-ready FTP upload root is [`public/`](public/). The older R Markdown source and generated `_site/` output remain outside it for historical reference during this renovation pass.

## Preview locally

No build or package installation is required.

```bash
python3 -m http.server 8765 --directory public
```

Open <http://127.0.0.1:8765/>. Also inspect `/404.html`, `/about.html`, `/contacts.html`, and `/cv.html`.

The site uses semantic HTML, one local stylesheet, minimal dependency-free JavaScript, one local portrait, and an SVG favicon. There are no CDN, analytics, tracking, database, CMS, or server-runtime dependencies.

## FileZilla deployment safety

Do not upload directly without a recoverable copy of the current site.

1. Download the entire current REG.ca `/www/` directory as a dated backup.
2. Upload the **contents of `public/`**, not the `public` folder itself.
3. Upload assets and secondary files first.
4. Upload `index.html` last so visitors do not receive a page whose assets are incomplete.
5. Verify desktop and mobile operation, including navigation, contact links, the 404 page, and legacy URLs.
6. Remove obsolete R Markdown output only after the replacement is confirmed working.

Do not use this repository as authority for the REG.ca document root, quota, `.htaccess` support, or backup policy. Confirm those account-specific facts before deployment.

## Editorial and review material

- [Editorial direction](docs/EDITORIAL_DIRECTION.md)
- [Factual and content review](docs/FACTUAL_REVIEW.md)
- [Photo brief](docs/PHOTO_BRIEF.md)
- [Visual review](artifacts/visual-review/README.md)

## Legacy paths

`about.html`, `contacts.html`, and `cv.html` are lightweight compatibility pages. They direct old incoming links to the appropriate homepage section without recreating the retired CV.

## Local verification

The standard-library checker can be run without installing packages:

```bash
python3 scripts/validate_static.py
node --check public/assets/js/site.js
```

The visual-review script uses Playwright when it is already available locally; Playwright is not a production dependency.
