var apiRoot = "http://cascadedevstats.azurewebsites.net/api/";
var youTrackRoot = "http://youtrack:9111";
var settings = undefined;
var burndownHistory = undefined;
var devStatsComplete = false;

$(document).ready(function () {
    SetRefresh();
    LoadSettings();
});

function SetRefresh() {
    setTimeout(function () { window.location.reload(); }, 300000);
}

function LoadSettings() {
    var podName = getURLParameter("team", true);
    var sprintName = getURLParameter("sprint", true);

    var url = apiRoot + "Sprint?pod=" + encodeURI(podName);

    if (sprintName != null && sprintName != "")
        url += "&sprint=" + encodeURI(sprintName)

    $.ajax({
        type: "Get",
        url: url,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            GetWorkRemainingData();
        }
    });
}

function GetDateArray() {
    var dates = [];
    var loop = 0;

    while (dates.length < settings.DurationDays) {
        var thisDate = new Date(settings.StartDate);
        thisDate.setDate(thisDate.getDate() + loop);

        if ((thisDate.getDay() !== 0) && (thisDate.getDay() !== 6))
            dates.push(DateToString(thisDate));

        loop = loop + 1;
    }

    return dates;
}

function GetBurndownHistory() {
    var url = apiRoot + "burndown?sprint=" + encodeURI(settings.Name);

    $.ajax({
        url: url,
        dataType: "json",
        type: "GET",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            burndownHistory = jsonData;
            CalculateBurndown();
        }
    });
}

function CalculateBurndown() {
    var dates = GetDateArray();
    var idealTrend = GetIdealTrend(dates);
    var today = GetToday();
    var latestRemainingCapacity = 0;

    if (burndownHistory.Days.length > 0)
        latestRemainingCapacity = burndownHistory.Days[burndownHistory.Days.length - 1].WorkRemaining;

    var remainingWork = [];

    for (var dateIndex in dates) {
        remainingWork.push(latestRemainingCapacity);

        for (var burndownDayIndex in burndownHistory.Days) {
            var burndownDay = burndownHistory.Days[burndownDayIndex];

            if (DateToString(burndownDay.Date) == dates[dateIndex])
                remainingWork[dateIndex] = burndownDay.WorkRemaining;
        }
    }

    DrawChart(dates, idealTrend, remainingWork);
}

function GetToday() {
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth();
    var day = today.getDate();

    return new Date(year, month, day, 0, 0, 0, 0);
}

function GetIdealTrend(dates) {
    var idealTrend = [];
    var numberOfDays = parseInt(settings.DurationDays);
    var effort = parseInt(settings.PlannedEffort);

    for (var dateIndex in dates) {
        var targetForDay = (effort / numberOfDays) * (numberOfDays - dateIndex - 1);
        idealTrend.push(targetForDay);
    }

    return idealTrend;
}

function DrawChart(dates, idealTrend, workRemaining) {
    CreateChartContainer();

    var today = DateToString(GetToday());
    var fromLoc = 0;
    var toLoc = 0.5;
    var foundDatePosition = false;
    var title = settings.Name;
    var lineWidth = 2;

    var urlLineWidth = getURLParameter("LineWidth");
    if (urlLineWidth !== null)
        lineWidth = parseInt(urlLineWidth);

    for (index = 0; index < dates.length; index++) {
        if (dates[index] == today) {
            fromLoc = index - 0.5;
            toLoc = index + 0.5;
            foundDatePosition = true;
        }
    }

    if (!foundDatePosition) {
        fromLoc = 0;
        toLoc = 0;
    }

    $('#container').highcharts({
        title: {
            text: title,
            x: -20, //center,
            style: {
                fontWeight: 'bold',
                fontSize: '30px',
                cursor: 'pointer'
            },
        },
        xAxis: {
            categories: dates,
            plotBands: {
                color: '#fea', // Color value
                from: fromLoc, // Start of the plot band
                to: toLoc // End of the plot band
            }
        },
        yAxis: {
            title: {
                text: 'Work Remaining (Latest)'
            },
            min: 0,
            plotLines: [{
                value: 0,
                width: 1,
                color: '#808080'
            }]
        },
        series: [{
            name: 'Ideal Work Remaining (End of Day)',
            data: idealTrend,
            lineWidth: lineWidth,
            lineColor: '#3333ff',
            marker: {
                fillColor: '#ffffff',
                lineWidth: 2,
                lineColor: '#3333ff'
            }
        }, {
            name: 'Work Remaining',
            data: workRemaining,
            lineWidth: lineWidth,
            lineColor: '#000000',
            marker: {
                fillColor: '#ffffff',
                lineWidth: 2,
                lineColor: '#000000'
            }
        }]
    });

    $("tspan").click(function () {
        GotoYouTrack();
    });
}

function CreateChartContainer() {
    var chartWidth = window.innerWidth - 20;
    var chartHeight = window.innerHeight - 20;

    if (chartWidth < 100) chartWidth = 100;
    if (chartHeight < 100) chartHeight = 100;

    var markUp = '<div id="container" style="min-width: ' + chartWidth + 'px; height: ' + chartHeight + 'px; margin: 0 auto"></div>';

    $("body").empty();
    $("body").append(markUp);
}

function GetWorkRemainingData() {
    DisplayMessage("Polling YouTrack for work remaining data");

    var dataUrl = youTrackRoot + "/rest/issue?filter=" + encodeURI(GetYouTrackFilter()) + "&max=500";

    $.ajax({
        url: dataUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            AnalyzeWorkRemainingData(jsonData);
        },
        error: function () {
            GetBurndownHistory();
        }
    });
}

function AnalyzeWorkRemainingData(youTrackData) {
    DisplayMessage("Analyzing Work Remaining Data...");
    var workRemaining = 0;

    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];
        var type = "Unknown";
        var state = "Unknown";
        var sprint = "Unknown";
        var estimate = 0;
        var workRemainingForTask = 0;

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "State") state = field.value[0];
            if (field.name === "Estimate") estimate = parseInt(field.value[0]);
            if (field.name === "WorkRemaining") workRemainingForTask = parseInt(field.value[0]);
            if (field.name === "Sprint") sprint = field.value[0];
        }

        if (estimate >= 0 && workRemainingForTask === 0)
            workRemainingForTask = estimate;

        workRemaining += workRemainingForTask;
    }

    PostWorkRemainingForSprint(workRemaining);
}

function PostWorkRemainingForSprint(workRemaining) {
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth() + 1;
    var day = today.getDate();

    if (month < 10) month = "0" + month;
    if (day < 10) day = "0" + day;

    var dataPackage = '{"Sprint":"' + settings.Name + '","Date":"' + year + '-' + month + '-' + day + 'T00:00:00.000Z","WorkRemaining":' + workRemaining + '}';

    var postUrl = apiRoot + "/burndown";

    $.ajax({
        type: "POST",
        url: postUrl,
        data: dataPackage,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (jsonData) {
            GetBurndownHistory();
        },
        error: function (jsonData) {
            GetBurndownHistory();
        }
    });
}

function DisplayMessage(messageText) {
    var markUp = "<div class='message-banner'>" + messageText + "</div>";
    $("body").empty();
    $("body").append(markUp);
}

function GetYouTrackFilter()
{
    var filter = "Sprint: {" + settings.Name + "} ";
    filter += "State: {Submitted}, {Designing}, {Ready to Start}, {In Progress} ";
    filter += "Type: {Task}, {Testing Task}, {Rework Task}, {Product Owner Review}, {Merge}, {AC Rework Task} ";
    filter += " order by: {issue id} desc";

    return filter;
}

function GotoYouTrack() {
    var url = youTrackRoot + '/issues?q=' + encodeURI(GetYouTrackFilter());

    window.location.href = url;
}