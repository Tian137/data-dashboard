(function () {
    window.DataDashboardTemplatePlatform.registerWorkbook({
        id: "demo-price",
        hidden: true,
        fileName: "demo-price.xlsx",
        title: "价格模板示例",
        description: "隐藏示例：复用现有价格对比表型，只靠 manifest 新增模板。",
        tags: ["示例", "复用现有类型"],
        sheets: [{
            id: "price",
            name: "示例价格表",
            type: "price-comparison",
            config: {
                items: [
                    { id: "steam", name: "动力煤" },
                    { id: "clean", name: "洗精煤" }
                ]
            }
        }]
    });
})();
