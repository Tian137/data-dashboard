(function () {
    window.DataDashboardTemplatePlatform.registerWorkbook({
        id: "4",
        fileName: "4.xlsx",
        title: "煤炭销售统计表",
        description: "来自“3月1日至3月7日”周销售表。按产品和日维度录入窑煤、靖煤销量，页面自动汇总周小计和周合计。",
        tags: ["销售", "周报", "日维度"],
        sheets: [{
            id: "sales",
            name: "3月1日至3月7日",
            type: "weekly-sales",
            config: {
                products: [
                    { id: "mix", name: "①混煤" },
                    { id: "lump", name: "②块煤" },
                    { id: "clean", name: "③洗精煤" },
                    { id: "silicon", name: "④硅煤" },
                    { id: "middling", name: "⑤中煤" },
                    { id: "slime", name: "⑥煤泥" },
                    { id: "powder", name: "⑦煤粉" },
                    { id: "mix-lump", name: "⑧混块" },
                    { id: "rough-clean", name: "⑨粗洗煤" },
                    { id: "gangue", name: "⑩煤矸石" },
                    { id: "gangue-mix", name: "⑪煤矸混合" },
                    { id: "washed-gangue", name: "⑫洗矸石" }
                ],
                weeks: [
                    {
                        id: "currentWeek",
                        label: "本周（3月1日-3月7日）",
                        days: ["3/1", "3/2", "3/3", "3/4", "3/5", "3/6", "3/7"]
                    }
                ]
            }
        }]
    });
})();
