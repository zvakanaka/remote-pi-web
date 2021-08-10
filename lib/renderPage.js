module.exports = function renderPage(title, content, style = '') {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      ${style}
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`
};
