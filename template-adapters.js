(function () {
    if (window.__dataDashboardAdapterLoaderReady) {
        return;
    }
    window.__dataDashboardAdapterLoaderReady = true;

    document.write([
        '<script src="./template-monthly.js?v=20260401-1"><\/script>',
        '<script src="./template-price.js?v=20260401-1"><\/script>',
        '<script src="./template-sales.js?v=20260401-1"><\/script>',
        '<script src="./template-note.js?v=20260401-1"><\/script>'
    ].join(""));
})();
