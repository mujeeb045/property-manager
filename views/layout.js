const ejs = require('ejs');
const path = require('path');

function wrapHTML(title, bodyContent) {
  try {
    const viewsPath = path.join(__dirname, '../views');
    
    return ejs.render(`
      <%- include('layout/base', { 
        title: title || 'Property Manager', 
        body: bodyContent 
      }) %>
    `, {
      title: title || 'Property Manager',
      bodyContent: bodyContent
    }, {
      views: viewsPath,
      filename: path.join(viewsPath, 'dummy.ejs')  // Helps with relative includes
    });
  } catch (err) {
    console.error("EJS Render Error:", err);
    return `
      <div class="p-10 max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl">
        <h2 class="text-red-600 text-xl font-bold mb-4">❌ Rendering Error</h2>
        <pre class="bg-white p-4 rounded text-sm overflow-auto">${err.message}</pre>
        <p class="mt-4 text-sm text-gray-600">Check that <strong>views/layout/base.ejs</strong> exists.</p>
      </div>`;
  }
}

module.exports = { wrapHTML };