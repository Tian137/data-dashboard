(function () {
    window.DataDashboardTemplatePlatform.registerWorkbook({
        id: "1",
        fileName: "1.xlsx",
        title: "煤炭售价统计表",
        description: "来自“集团公司煤炭售价统计表”。保留固定品种，录入本周、上周和预测价格，页面自动给出环比变化。",
        tags: ["售价", "周报", "自动环比"],
        sheets: [{
            id: "price",
            name: "2026年3月第一周",
            type: "price-comparison",
            config: {
                items: [
                    { id: "section-mixed", name: "一、混煤（元/吨）" },
                    { id: "section-power", name: "二、电煤（元/吨）" },
                    { id: "section-market", name: "三、市场煤" },
                    { id: "coking", name: "配焦煤" },
                    { id: "washed", name: "水洗煤" },
                    { id: "lump", name: "块煤" }
                ]
            }
        }]
    });
})();
