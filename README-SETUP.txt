DESIGN FUSION — WEBSITE PACKAGE

This package keeps the existing Design Fusion design and pages. It fixes the contact form and adds a protected owner-only project upload workflow.

1) START THE WEBSITE
- Install Node.js LTS.
- Extract this folder.
- Open a terminal inside the design-fusion-website folder.
- Run: npm install
- Set the two private environment variables below, then run: npm start

Required private settings:
  ADMIN_PASSWORD = choose a strong password only you know
  SESSION_SECRET = a long random secret string

Windows PowerShell example (replace both sample values with your own):
  $env:ADMIN_PASSWORD="your-private-owner-password"
  $env:SESSION_SECRET="a-long-random-secret-value"
  npm start

Then open http://localhost:3000

2) OWNER ACCESS AND PROJECT UPLOADS
- Open http://localhost:3000/owner.html
- Sign in using the ADMIN_PASSWORD you set above.
- Open Manage projects.
- The Owner mode / Add a project controls appear on project.html only while the owner is signed in.
- Enter a title and category, choose a file, and upload it. The owner can also remove projects.
- Visitors can view and download published projects but cannot upload, edit, or delete them. The server checks the owner session for every upload/delete request; hiding the buttons alone is not the security measure.

Supported project files include image, video, audio, PDF, Word/Excel/PowerPoint, Adobe Photoshop/Illustrator/InDesign, Figma/Sketch/XD exports, archives, fonts, CAD and 3D assets. The upload accepts files by extension except executable or web-code file types that could put visitors at risk. Common image files display previews; other formats are shown as downloadable project cards. Default upload limit is 500 MB per file. Change MAX_UPLOAD_MB in the hosting environment if your host permits a different limit.

3) CONTACT FORM EMAIL DELIVERY
The Contact page sends form submissions to desiginfusion000@gmail.com using FormSubmit. On the first test submission, FormSubmit sends an activation email to that inbox. Open it and click its confirmation link. After confirmation, submit another test and check Inbox and Spam/Junk.

The form sends the visitor's name, reply email and message. This is a third-party form service, not direct Gmail SMTP. Do not put your Gmail password or Google account password in website code.

4) DEPLOY ONLINE
Deploy the entire folder to a Node.js host that supports persistent disk storage and HTTPS. Set ADMIN_PASSWORD, SESSION_SECRET and (optionally) MAX_UPLOAD_MB in the host's private environment settings. Keep data/ and uploads/ on persistent storage and back them up. Do not use a static-only hosting service for owner uploads. In production set NODE_ENV=production so the owner session cookie is marked Secure (HTTPS required).

5) IMPORTANT NOTES
- Keep the folder structure and filenames intact, including "contect me .html".
- The owner access page is not linked in public navigation. Keep its URL private and use a strong password.
- Uploaded originals are stored on the server; Photoshop/Illustrator/InDesign source files are not edited in the browser. Visitors can download them and open them in compatible software.
- The included Express session uses its default in-memory store. For a high-traffic production site, configure a persistent session store provided by your hosting platform.
