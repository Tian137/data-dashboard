(function () {
    function matrixRow(id, col1, col2, col3, unit, annualPlan) {
        return {
            id: id,
            labels: [col1 || "", col2 || "", col3 || "", unit || ""],
            annualPlan: annualPlan || ""
        };
    }

    window.DataDashboardTemplatePlatform.registerWorkbook({
        id: "2",
        fileName: "2.xlsx",
        title: "产量与工业总产值统计表",
        description: "保留原工作簿中的两张统计表结构，用于按月份录入计划、实际和同比数据。",
        tags: ["产量", "工业总产值", "双标签页"],
        sheets: [
            {
                id: "production",
                name: "产量表",
                type: "monthly-matrix",
                description: "依据原 Excel 的月度结构，录入当月实际和去年同期，累计值与增降幅自动计算。",
                config: {
                    rows: [
                        matrixRow("coal-total", "煤炭产量", "合计", "", "万吨", "1600"),
                        matrixRow("coal-yaomei-group", "", "窑煤公司", "四个井工矿", "万吨", "505"),
                        matrixRow("coal-jinhe", "", "", "金河煤矿", "万吨", "105"),
                        matrixRow("coal-sankuang", "", "", "三矿", "万吨", "140"),
                        matrixRow("coal-haishiwan", "", "", "海石湾煤矿", "万吨", "180"),
                        matrixRow("coal-tianzhu", "", "", "天祝公司", "万吨", "80"),
                        matrixRow("coal-tianbao", "", "", "天宝煤业", "万吨", "150"),
                        matrixRow("coal-yaomei-subtotal", "", "", "窑煤小计", "万吨", "655"),
                        matrixRow("coal-jingmei-group", "", "靖煤公司", "四个井工矿", "万吨", "885"),
                        matrixRow("coal-weijiadi", "", "", "魏家地煤矿", "万吨", "265"),
                        matrixRow("coal-dashuitou", "", "", "大水头煤矿", "万吨", "220"),
                        matrixRow("coal-honghui", "", "", "红会一矿", "万吨", "130"),
                        matrixRow("coal-wangjiashan", "", "", "王家山煤矿（含一号井）", "万吨", "270"),
                        matrixRow("coal-jingtai", "", "", "景泰煤业", "万吨", "60"),
                        matrixRow("coal-jingmei-subtotal", "", "", "靖煤小计", "万吨", "945"),
                        matrixRow("power-total", "发电量", "合计", "", "万千瓦时", "660000"),
                        matrixRow("power-baiyin", "", "白银热电", "", "万千瓦时", "300000"),
                        matrixRow("power-lanzhou", "", "兰州新区热电", "", "万千瓦时", "300000"),
                        matrixRow("power-solidwaste", "", "固废物利用热电", "", "万千瓦时", "60000"),
                        matrixRow("chemical-liuhua-urea", "化工产品产量", "刘化化工", "尿素产量", "万吨", "37.47"),
                        matrixRow("chemical-liuhua-acid", "", "", "浓硝酸产量", "万吨", "7.89"),
                        matrixRow("chemical-liuhua-fertilizer", "", "", "复合肥产量", "万吨", "6.18"),
                        matrixRow("chemical-liuhua-ammonia", "", "", "液氨产量", "万吨", "5.49"),
                        matrixRow("chemical-liuhua-methanol", "", "", "甲醇产量", "万吨", "6.35"),
                        matrixRow("chemical-jinchang-urea", "", "金昌公司", "尿素产量", "万吨", "30"),
                        matrixRow("chemical-jinchang-ammonia", "", "", "合成氨产量", "万吨", "36"),
                        matrixRow("chemical-urea-subtotal", "尿素产量小计", "", "", "万吨", "67.47"),
                        matrixRow("other-shale-oil", "其他产品", "油页岩公司", "页岩油", "万吨", "1.01"),
                        matrixRow("other-ferroalloy", "", "兴元公司", "铁合金产量", "万吨", "3.9"),
                        matrixRow("other-cement", "", "派仕得公司", "水泥产量", "万吨", "30")
                    ],
                    endFields: []
                }
            },
            {
                id: "output",
                name: "工业总产值表",
                type: "monthly-matrix",
                description: "按月份录入工业总产值，页面自动计算当月与累计增降幅，并支持预计完成和超欠计划。",
                config: {
                    rows: [
                        matrixRow("output-group-total", "集团公司合计", "", "", "万元", ""),
                        matrixRow("output-nonlisted-subtotal", "集团非上市小计", "", "", "万元", ""),
                        matrixRow("output-listed-total", "股份公司合计", "", "", "万元", ""),
                        matrixRow("output-yaomei-subtotal-top", "窑煤小计", "", "", "万元", ""),
                        matrixRow("output-jingmei-subtotal-top", "靖煤小计", "", "", "万元", ""),
                        matrixRow("output-yaomei-mines", "窑煤公司", "四个井工矿", "", "万元", ""),
                        matrixRow("output-tianbao", "", "天宝煤业", "", "万元", ""),
                        matrixRow("output-ronghe", "", "融禾洗煤厂", "", "万元", ""),
                        matrixRow("output-tianhe", "", "天禾洗煤厂", "", "万元", ""),
                        matrixRow("output-jinkai", "", "金凯公司", "", "万元", ""),
                        matrixRow("output-solidwaste", "", "固废物利用热电", "", "万元", ""),
                        matrixRow("output-oilshale", "", "油页岩公司", "", "万元", ""),
                        matrixRow("output-kebei", "", "科贝德公司", "", "万元", ""),
                        matrixRow("output-yaomei-other", "", "其   他", "", "万元", ""),
                        matrixRow("output-yaomei-subtotal", "", "窑煤小计", "", "万元", ""),
                        matrixRow("output-jingmei-mines", "靖煤公司", "四个井工矿", "", "万元", ""),
                        matrixRow("output-jingtai", "", "景泰煤业", "", "万元", ""),
                        matrixRow("output-coaldev", "", "煤炭开发公司", "", "万元", ""),
                        matrixRow("output-jingtai-wash", "", "景泰洗煤厂", "", "万元", ""),
                        matrixRow("output-dashuitou-wash", "", "大水头洗煤厂", "", "万元", ""),
                        matrixRow("output-weijiadi-wash", "", "魏家地洗煤厂", "", "万元", ""),
                        matrixRow("output-galaxy", "", "银河制造公司", "", "万元", ""),
                        matrixRow("output-hydro", "", "水电分公司", "", "万元", ""),
                        matrixRow("output-huaneng", "", "华能建材", "", "万元", ""),
                        matrixRow("output-jienen", "", "洁能热电公司", "", "万元", ""),
                        matrixRow("output-jingmei-subtotal", "", "靖煤小计", "", "万元", ""),
                        matrixRow("output-total-power", "合 计", "", "", "万元", ""),
                        matrixRow("output-baiyin", "白银热电", "", "", "万元", ""),
                        matrixRow("output-xinqu", "新区热电", "", "", "万元", ""),
                        matrixRow("output-liuhua", "刘化化工公司", "", "", "万元", ""),
                        matrixRow("output-storage", "储运公司", "", "", "万元", ""),
                        matrixRow("output-total-other", "合 计", "", "", "万元", ""),
                        matrixRow("output-xingyuan", "兴元公司", "", "", "万元", ""),
                        matrixRow("output-paishide", "派仕得公司", "", "", "万元", ""),
                        matrixRow("output-jinneng", "金能公司", "", "", "万元", ""),
                        matrixRow("output-lvjin", "绿锦环保公司", "", "", "万元", ""),
                        matrixRow("output-lvneng", "绿能公司", "", "", "万元", ""),
                        matrixRow("output-jinchang", "金昌公司", "", "", "万元", ""),
                        matrixRow("output-nonlisted-final", "非上市部分小计", "", "", "万元", "")
                    ],
                    endFields: [
                        { key: "forecastComplete", label: "预计完成", editable: true },
                        { key: "planGap", label: "超欠计划", editable: false }
                    ]
                }
            }
        ]
    });
})();
