var youTrackIssues = [];
var issuedLogged = [];
var apiStarted = 0;
var apiCompleted = 0;
var settings = undefined;

$(document).ready(function () {
    ShowDevLog();
});

function ShowDevLog() {
    $.ajax({
        type: "Get",
        url: "./Data/DevLogParameters.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            SetRefresh();
            GetYouTrackData();
        }
    });
}

function GetYouTrackData() {
    youTrackIssues = [];
    issuedLogged = [];
    apiStarted = 0;
    apiCompleted = 0;

    var baseFilter = "project: ";
    var firstProjectDone = false;
    for (var projectIndex in settings.Projects) {
        if (firstProjectDone)
            baseFilter += ", ";
        else
            firstProjectDone = true;
        baseFilter += "{" + settings.Projects[projectIndex] + "}";
    }

    baseFilter += " Type: ";

    var firstTaskTypeDone = false;
    for (var taskIndex in settings.TaskTypes) {
        if (firstTaskTypeDone)
            baseFilter += ", ";
        else
            firstTaskTypeDone = true;
        baseFilter += "{" + settings.TaskTypes[taskIndex] + "}";
    }
    
    var theDate = GetStartDate();
    var thisMonth = theDate.getMonth() + 1;
    baseFilter += " DoneDate: " + theDate.getFullYear() + "-";
    if (thisMonth < 10)
        baseFilter += "0";
    baseFilter += thisMonth;
    baseFilter += " .. Today ";

    for (var devIndex in settings.Developers) {
        var devUserName = settings.Developers[devIndex].UserName;
        var filterText = baseFilter + " Assignee: " + devUserName;
        filterText = encodeURI(filterText);

        var queryText = settings.YouTrackRootUrl + "/rest/issue?filter=" + filterText + "&max=500";
        apiStarted++;

        CallYouTrackApi(queryText, devUserName);
    }

    setTimeout(function () { DisplaySummaryWhenReady() }, 1000);
}

function CallYouTrackApi(apiUrl, devUserName) {
    $.ajax({
        url: apiUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            ConvertYouTrackDataToObjects(jsonData, devUserName);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });
}

function SetHeader() {
    var markUp = "<div class='header-bar'>";
    markUp += "<a href='index.html' class='Header-Command'>Home</a>";
    markUp += "<a href='#' onclick='javascript:RefreshData();' class='Header-Command'>Refresh Data</a>";
    markUp += "<a href='#' onclick='javascript:DisplayDataByDeveloper();' class='Header-Command'>Dev Data</a>";
    markUp += "<a href='#' onclick='javascript:DisplayDataAsChartForAll();' class='Header-Command'>Dev Chart</a>";
    markUp += "<a href='#' onclick='javascript:DisplayDataByTeam();' class='Header-Command'>Team Data</a>";
    markUp += "<a href='#' onclick='javascript:DisplayDataAsTeamChart();' class='Header-Command'>Team Chart</a>";
    markUp += "</div>";
    $("body").append(markUp);
}

function RefreshData() {
    ShowDefectSummary();
}

function ConvertYouTrackDataToObjects(jsonData, userName) {
    for (var taskLocation in jsonData.issue) {
        var task = jsonData.issue[taskLocation];
        var resolved = undefined;
        var state = undefined;
        var type = undefined;
        var title = undefined;
        var subSystem = undefined;
        var issueId = task.id;
        var developer = userName
        var estimate = 0;
        var actualTime = 0;
        var sprint = undefined;
        var team = undefined;

        if (issuedLogged.indexOf(issueId) > -1) continue;

        issuedLogged.push(issueId);

        for (var fieldLocation in task.field) {
            var field = task.field[fieldLocation];

            if (field.name === "Type") {
                type = field.value[0];
            }

            if (field.name === "State") {
                state = field.value[0];
            }

            if (field.name === "DoneDate") {
                resolved = ConvertYouTrackDate(field.value);
            }

            if (field.name === "summary") {
                title = field.value;
            }

            if (field.name === "Subsystem") {
                subSystem = field.value[0];
            }

            if (field.name === "Estimate") {
                estimate = field.value[0];
            }

            if (field.name === "ActualTime") {
                actualTime = field.value[0];
            }

            if (field.name === "Sprint") {
                sprint = field.value[0];
                team = sprint.split(" ")[0];
            }
        }

        if ((actualTime === 0) && (estimate !== 0))
            actualTime = estimate;

        var taskObject = new Object();
        taskObject.Type = type;
        taskObject.State = state;
        taskObject.Resolved = resolved;
        taskObject.Title = title;
        taskObject.IssueId = issueId;
        taskObject.Subsystem = subSystem;
        taskObject.DeveloperUserName = developer;
        taskObject.Estimate = estimate;
        taskObject.ActualTime = actualTime;
        taskObject.Sprint = sprint;
        taskObject.Team = team;

        youTrackIssues.push(taskObject);
    }

    return youTrackIssues;
}

function DisplaySummaryWhenReady() {
    if (apiCompleted === apiStarted) {
        DisplayDataByDeveloper();
    }
    else {
        setTimeout(function () { DisplaySummaryWhenReady(settings) }, 1000);
    }
}

function SortByDate(a, b) {
    if (a.Resolved < b.Resolved)
        return 1;
    else if (a.Resolved > b.Resolved)
        return -1;
    else
        return 0;
}

function SortByDevAndDate(a, b) {
    if (a.DeveloperUserName < b.DeveloperUserName)
        return 1;
    else if (a.DeveloperUserName > b.DeveloperUserName)
        return -1;
    else if (a.Resolved < b.Resolved)
        return 1;
    else if (a.Resolved > b.Resolved)
        return -1;
    else
        return 0;
}

function SortByTeamAndDate(a, b) {
    if (a.Team < b.Team)
        return 1;
    else if (a.Team > b.Team)
        return -1;
    else if (a.Resolved < b.Resolved)
        return 1;
    else if (a.Resolved > b.Resolved)
        return -1;
    else
        return 0;
}

function DisplayDataByDeveloper() {
    $("body").empty();
    SetHeader();

    var summaries = GetDevBreakdown("ALL");

    for (var summaryIndex in summaries){
        var summaryItem = summaries[summaryIndex];

        var markUp = "<H1>" + summaryItem.FullName + "&nbsp;<a onclick='javascript:DisplayChart_Click(this);' data-username='" + summaryItem.UserName + "' data-fullname='" + summaryItem.FullName + "'><img src='Images/graph_icon.png' class='chart-icon'></img></a></H1>";
        markUp += "<table class='table-developer-breakdown'>";
        markUp += "<tr><th class='text-cell'>Month</th><th class='numeric-cell'>Tasks</th><th class='numeric-cell'>Reworks</th><th class='numeric-cell'>Estimated (hrs/mth)</th><th class='numeric-cell'>Actual (hrs/mth)</th></tr>";
        
        for (var breakdownIndex in summaryItem.Breakdown) {
            markUp += "<tr>"
            markUp += "<td class='text-cell'>" + summaryItem.Breakdown[breakdownIndex].MonthLabel + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalTasks + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalReworks + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalEstimate + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalActual + "</td>";
            markUp += "</tr>";
        }

        $("body").append(markUp);
    }

    ShowRowColoursForBreakdowns();
}

function DisplayDataAsChartForAll() {
    DisplayDataAsChart("ALL", "Developer Log");
}

function DisplayChart_Click(control) {
    var userName = $(control).data("username");
    var fullName = $(control).data("fullname");
    DisplayDataAsChart(userName, fullName);
}

function DisplayDataAsChart(filterText, titleText) {
    $("body").empty();
    SetHeader();

    var summaries = GetDevBreakdown(filterText);

    var chartData = new Object();
    chartData.title = new Object();
    chartData.title.text = titleText;
    chartData.title.x = -20;
    chartData.title.style = new Object();
    chartData.title.style.fontWeight = "bold";
    chartData.title.style.fontSize = "30px";
    chartData.xAxis = new Object();
    chartData.xAxis.categories = [];
    chartData.yAxis = new Object();
    chartData.yAxis.title = new Object();
    chartData.yAxis.title.text = "Actual Time";
    chartData.yAxis.min = 0;
    chartData.yAxis.plotLines = [];
    var yaxisPlotline = new Object;
    yaxisPlotline.value= 0;
    yaxisPlotline.width= 1;
    yaxisPlotline.color= '#808080';
    chartData.yAxis.plotLines.push(yaxisPlotline);
    chartData.series = [];
    
    for (var breakdownLocation in summaries[0].Breakdown) {
        chartData.xAxis.categories.unshift(summaries[0].Breakdown[breakdownLocation].MonthLabel);
    }

    for (var summaryLocation in summaries) {
        var seriesItem = new Object();
        seriesItem.name = summaries[summaryLocation].FullName;
        seriesItem.data = [];

        for (var breakDownLocation in summaries[summaryLocation].Breakdown) {
            seriesItem.data.unshift(summaries[summaryLocation].Breakdown[breakDownLocation].TotalActual);
        }

        chartData.series.push(seriesItem);
    }

    var markUp = '<div id="container" style="min-width: 800px; height: 930px; margin: 0 auto"></div>';
    $("body").append(markUp);

    var jsonChartData = JSON.stringify(chartData);

    $('#container').highcharts(chartData);
}

function DisplayDataByTeam() {
    $("body").empty();
    SetHeader();

    var summaries = GetTeamBreakdown("ALL");

    for (var summaryIndex in summaries) {
        var summaryItem = summaries[summaryIndex];

        var markUp = "<H1>" + summaryItem.Team + "</H1>";
        markUp += "<table class='table-developer-breakdown'>";
        markUp += "<tr><th class='text-cell'>Month</th><th class='numeric-cell'>Tasks</th><th class='numeric-cell'>Reworks</th><th class='numeric-cell'>Estimated (hrs/mth)</th><th class='numeric-cell'>Actual (hrs/mth)</th></tr>";

        for (var breakdownIndex in summaryItem.Breakdown) {
            markUp += "<tr>"
            markUp += "<td class='text-cell'>" + summaryItem.Breakdown[breakdownIndex].MonthLabel + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalTasks + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalReworks + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalEstimate + "</td>";
            markUp += "<td class='numeric-cell'>" + summaryItem.Breakdown[breakdownIndex].TotalActual + "</td>";
            markUp += "</tr>";
        }

        $("body").append(markUp);
    }

    ShowRowColoursForBreakdowns();
}

function DisplayDataAsTeamChart() {
    $("body").empty();
    SetHeader();

    var summaries = GetTeamBreakdown("ALL");

    var chartData = new Object();
    chartData.title = new Object();
    chartData.title.text = "Developer Log";
    chartData.title.x = -20;
    chartData.title.style = new Object();
    chartData.title.style.fontWeight = "bold";
    chartData.title.style.fontSize = "30px";
    chartData.xAxis = new Object();
    chartData.xAxis.categories = [];
    chartData.yAxis = new Object();
    chartData.yAxis.title = new Object();
    chartData.yAxis.title.text = "Actual Time";
    chartData.yAxis.min = 0;
    chartData.yAxis.plotLines = [];
    var yaxisPlotline = new Object;
    yaxisPlotline.value = 0;
    yaxisPlotline.width = 1;
    yaxisPlotline.color = '#808080';
    chartData.yAxis.plotLines.push(yaxisPlotline);
    chartData.series = [];

    for (var breakdownLocation in summaries[0].Breakdown) {
        chartData.xAxis.categories.unshift(summaries[0].Breakdown[breakdownLocation].MonthLabel);
    }

    for (var summaryLocation in summaries) {
        var seriesItem = new Object();
        seriesItem.name = summaries[summaryLocation].Team;
        seriesItem.data = [];

        for (var breakDownLocation in summaries[summaryLocation].Breakdown) {
            seriesItem.data.unshift(summaries[summaryLocation].Breakdown[breakDownLocation].TotalActual);
        }

        chartData.series.push(seriesItem);
    }

    var markUp = '<div id="container" style="min-width: 800px; height: 930px; margin: 0 auto"></div>';
    $("body").append(markUp);

    var jsonChartData = JSON.stringify(chartData);

    $('#container').highcharts(chartData);
}

function GetDevBreakdown(filterText) {
    youTrackIssues.sort(SortByDevAndDate);

    var summaries = [];

    for (var devIndex in settings.Developers) {
        var summaryItem = new Object();
        summaryItem.UserName = settings.Developers[devIndex].UserName;
        summaryItem.FullName = settings.Developers[devIndex].FullName;
        summaryItem.Breakdown = [];

        var today = new Date();
        var workingDate = GetStartDate();
        var monthString = undefined;

        while (workingDate < today) {
            if ((monthString === undefined) || (monthString != GetMonthString(workingDate))) {
                monthString = GetMonthString(workingDate);

                var breakDownItem = new Object();
                breakDownItem.MonthLabel = monthString;
                breakDownItem.TotalTasks = 0;
                breakDownItem.TotalReworks = 0;
                breakDownItem.TotalEstimate = 0;
                breakDownItem.TotalActual = 0;

                summaryItem.Breakdown.unshift(breakDownItem);
            }

            workingDate.setDate(workingDate.getDate() + 1);
        }

        if ((filterText === "ALL") || (filterText === settings.Developers[devIndex].UserName))
            summaries.push(summaryItem);
    }

    for (var issueIndex in youTrackIssues) {
        var youTrackIssue = youTrackIssues[issueIndex];
        for (var summaryIndex in summaries) {
            var summaryItem = summaries[summaryIndex];

            if (summaryItem.UserName === youTrackIssue.DeveloperUserName) {
                var youTrackIssueMonth = GetStringDateAsMonthText(youTrackIssue.Resolved);
                for (var breakdownIndex in summaryItem.Breakdown) {
                    if (summaryItem.Breakdown[breakdownIndex].MonthLabel === youTrackIssueMonth) {
                        summaryItem.Breakdown[breakdownIndex].TotalEstimate += parseInt(youTrackIssue.Estimate);
                        summaryItem.Breakdown[breakdownIndex].TotalActual += parseInt(youTrackIssue.ActualTime);
                        if (youTrackIssue.Type === "Rework Task")
                            summaryItem.Breakdown[breakdownIndex].TotalReworks += 1;
                        else
                            summaryItem.Breakdown[breakdownIndex].TotalTasks += 1;
                    }
                }
            }
        }
    }

    return summaries;
}

function GetTeamBreakdown(filterText) {
    youTrackIssues.sort(SortByTeamAndDate);

    var summaries = [];

    for (var teamIndex in settings.Teams) {
        var summaryItem = new Object();
        summaryItem.Team = settings.Teams[teamIndex];
        summaryItem.Breakdown = [];

        var today = new Date();
        var workingDate = GetStartDate();
        var monthString = undefined;

        while (workingDate < today) {
            if ((monthString === undefined) || (monthString != GetMonthString(workingDate))) {
                monthString = GetMonthString(workingDate);

                var breakDownItem = new Object();
                breakDownItem.MonthLabel = monthString;
                breakDownItem.TotalTasks = 0;
                breakDownItem.TotalReworks = 0;
                breakDownItem.TotalEstimate = 0;
                breakDownItem.TotalActual = 0;

                summaryItem.Breakdown.unshift(breakDownItem);
            }

            workingDate.setDate(workingDate.getDate() + 1);
        }

        if ((filterText === "ALL") || (filterText === settings.Teams[teamIndex]))
            summaries.push(summaryItem);
    }

    for (var issueIndex in youTrackIssues) {
        var youTrackIssue = youTrackIssues[issueIndex];
        for (var summaryIndex in summaries) {
            var summaryItem = summaries[summaryIndex];

            if (summaryItem.Team === youTrackIssue.Team) {
                var youTrackIssueMonth = GetStringDateAsMonthText(youTrackIssue.Resolved);
                for (var breakdownIndex in summaryItem.Breakdown) {
                    if (summaryItem.Breakdown[breakdownIndex].MonthLabel === youTrackIssueMonth) {
                        summaryItem.Breakdown[breakdownIndex].TotalEstimate += parseInt(youTrackIssue.Estimate);
                        summaryItem.Breakdown[breakdownIndex].TotalActual += parseInt(youTrackIssue.ActualTime);
                        if (youTrackIssue.Type === "Rework Task")
                            summaryItem.Breakdown[breakdownIndex].TotalReworks += 1;
                        else
                            summaryItem.Breakdown[breakdownIndex].TotalTasks += 1;
                    }
                }
            }
        }
    }

    return summaries;
}

function GetDevFullName(devUserName) {
    for (var userIndex in settings.Developers) {
        if (devUserName === settings.Developers[userIndex].UserName)
            return settings.Developers[userIndex].FullName
    }

    return "Ooops";
}

function SetRefresh() {
    var navigationParameter = getURLParameter("DoNavigation");
    if (navigationParameter != null && navigationParameter === "Yes")
        window.setTimeout(function () { window.location.replace(settings.NextScreenUrl); }, settings.ScreenDuration);
}

function ShowRowColoursForBreakdowns() {
    $("table.table-developer-breakdown tr:even").addClass("alternate-row");
    $("table.table-developer-breakdown tr:odd").addClass("normal-row");
}

function GetStartDate() {
    var today = new Date();
    var firstDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDay(), 0, 0, 0, 0);
    var earliestDate = new Date(2015, 11, 1, 0, 0, 0, 0);

    if (firstDate < earliestDate)
        return earliestDate;
    else
        return firstDate;
}