const path = require('path');

function wrapHTML(title, bodyContent) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Property Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; }
        .tenant-item { transition: all 0.2s; }
        .tenant-item:hover { transform: translateY(-2px); }
    </style>
</head>
<body class="bg-gray-50">
    <div class="flex min-h-screen">
        <!-- Sidebar -->
        <div class="w-64 bg-white border-r border-gray-200 hidden md:block fixed h-screen overflow-auto">
            <div class="p-6 border-b">
                <h1 class="text-2xl font-bold text-emerald-600 flex items-center gap-2">
                    <i class="fas fa-building"></i> PropManage
                </h1>
            </div>
            <nav class="mt-4">
                <a href="/" class="flex items-center gap-3 px-6 py-3 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700"> 
                    <i class="fas fa-home w-5"></i> Dashboard
                </a>
                <a href="/tenants" class="flex items-center gap-3 px-6 py-3 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700">
                    <i class="fas fa-file-invoice-dollar w-5"></i> This Month Collection
                </a>
                <a href="/history" class="flex items-center gap-3 px-6 py-3 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700">
                    <i class="fas fa-history w-5"></i> History & Details
                </a>
                <a href="/settings" class="flex items-center gap-3 px-6 py-3 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700">
                    <i class="fas fa-cog w-5"></i> Settings
                </a>
            </nav>
        </div>

        <!-- Main Content -->
        <div class="flex-1 md:ml-64">
            <header class="bg-white border-b px-6 py-4 sticky top-0 z-10">
                <div class="flex justify-between items-center">
                    <h2 class="text-xl font-semibold text-gray-800">${title}</h2>
                </div>
            </header>
            <main class="p-6">
                ${bodyContent}
            </main>
        </div>
    </div>
</body>
</html>`;
}

module.exports = { wrapHTML };