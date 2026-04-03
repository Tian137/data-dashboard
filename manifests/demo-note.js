(function () {
    window.DataDashboardTemplatePlatform.registerWorkbook({
        id: "demo-note",
        hidden: true,
        fileName: "demo-note.xlsx",
        title: "简易记录模板示例",
        description: "隐藏示例：演示新增全新表型时，只新增适配器模块和 manifest。",
        tags: ["示例", "新表型"],
        sheets: [{
            id: "records",
            name: "简易记录表",
            type: "simple-note",
            description: "用于记录少量自定义字段和值的轻量模板。",
            config: {
                columns: [
                    { key: "item", label: "项目" },
                    { key: "value", label: "数值" },
                    { key: "note", label: "备注" }
                ],
                rows: [
                    {
                        id: "sample-row-1",
                        cells: {
                            item: "示例指标",
                            value: "100",
                            note: "用于验证新表型接入"
                        }
                    }
                ]
            }
        }]
    });
})();
