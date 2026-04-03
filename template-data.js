(function () {
    if (window.__dataDashboardManifestLoaderReady) {
        return;
    }
    window.__dataDashboardManifestLoaderReady = true;

    document.write([
        '<script src="./manifests/workbook-1.js?v=20260401-1"><\/script>',
        '<script src="./manifests/workbook-2.js?v=20260401-1"><\/script>',
        '<script src="./manifests/workbook-4.js?v=20260401-1"><\/script>',
        '<script src="./manifests/demo-price.js?v=20260401-1"><\/script>',
        '<script src="./manifests/demo-note.js?v=20260401-1"><\/script>'
    ].join(""));
})();
