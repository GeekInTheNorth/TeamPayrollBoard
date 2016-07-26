var settings = undefined;
var burndownHistory = undefined;
var youTrackItems = [];
var youTrackComplete = false;
var devStatsComplete = false;
var workRemainingToday = 0;

$(document).ready(function () {
    SetRefresh();
    LoadSettings();
});

function SetRefresh() {
    setTimeout(function () { window.location.reload(); }, 180000);
}

function LoadSettings() {
    $.ajax({
        type: "Get",
        url: "./Data/CapacityBurndownParameters.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            GetBurndownHistory();
            GetYouTrackData();
            WaitForDataToLoad();
        }
    });
}

function GetYouTrackData() {
    var team = GetTeam();

    var url = "Sprint: {" + team.Sprint + "} Type: ";

    for (var taskIndex in settings.TaskTypes) {
        if (taskIndex > 0)
            url += ", ";
        url += "{" + settings.TaskTypes[taskIndex] + "}";
    }

    url += " State: ";
    for (var wrsIndex in settings.WorkRemainingStates) {
        if (wrsIndex > 0)
            url += ", ";
        url += "{" + settings.WorkRemainingStates[wrsIndex] + "}";
    }

    url += " order by: updated desc";
    url = encodeURI(url);
    url = settings.YouTrackRootUrl + "/rest/issue?filter=" + url + "&max=500";

    $.ajax({
        url: url,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            AnalyseYouTrackData(team, jsonData);
        }
    });
}

function GetTeam() {
    var teamName = getURLParameter("Team");
    var teamDetails = undefined;

    for (var teamLocation in settings.Teams) {
        if (teamName === settings.Teams[teamLocation].Team)
            teamDetails = settings.Teams[teamLocation];
    }

    if (teamDetails === undefined)
        teamDetails = settings.Teams[0]

    return teamDetails;
}

function AnalyseYouTrackData(team, youTrackData) {
    var totalEstimate = 0;
    
    workRemainingToday = 0;

    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];
        var type = "Unknown";
        var state = "Unknown";
        var estimate = 0;
        var workRemaining = 0;

        for (var fieldIndex in task.field) {
            if (field.name === "State") state = field.value[0];
            if (field.name === "Estimate") estimate = parseInt(field.value[0]);
            if (field.name === "WorkRemaining") workRemaining = parseInt(field.value[0]);
        }

        if (state !== "In Progress" && estimate >= 0 && workRemaining === 0)
            workRemaining = estimate;

        workRemainingToday += workRemaining;
    }

    var today = GetToday();
    RecordCurrentOutstandingWork(team.Sprint, today, workRemainingToday);
    youTrackComplete = true;
}

function GetDateArray() {
    var dates = [];
    var loop = 0;

    while (dates.length < settings.SprintDurationDays) {
        var thisDate = new Date(settings.SprintStartDate);
        thisDate.setDate(thisDate.getDate() + loop);

        if ((thisDate.getDay() !== 0) && (thisDate.getDay() !== 6))
            dates.push(DateToString(thisDate));

        loop = loop + 1;
    }

    return dates;
}

function GetDailyCapacities(team, dates) {
    var capacities = [];

    for (var dateIndex in dates) {
        capacities.push(0);
    }

    for (var resourceIndex in team.Resource) {
        var resource = team.Resource[resourceIndex];
        var dailyCapacity = resource.DailyCapacity;

        for (var capacityIndex in capacities) {
            capacities[capacityIndex] = capacities[capacityIndex] + parseInt(dailyCapacity);
        }

        for (var exceptionIndex in resource.Exceptions) {
            var exceptionDate = DateToString(new Date(resource.Exceptions[exceptionIndex]));
            for (var dateIndex in dates) {
                if (dates[dateIndex] === exceptionDate)
                    capacities[dateIndex] = capacities[dateIndex] - dailyCapacity;
            }
        }
    }

    return capacities;
}

function GetBurndownHistory() {
    var team = GetTeam();
    var url = settings.DevStatsBurndownApi + "?sprint=" + encodeURI(team.Sprint);

    $.ajax({
        url: url,
        dataType: "json",
        type: "GET",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            AnalyzeBurndownHistory(jsonData);
        }
    });
}

function AnalyzeBurndownHistory(history) {
    burndownHistory = history;
    devStatsComplete = true;
}

function WaitForDataToLoad() {
    if (youTrackComplete && devStatsComplete)
        CalculateBurndown();
    else
        setTimeout(function () { WaitForDataToLoad() }, 1000);
}

function RecordCurrentOutstandingWork(sprint, today, workRemaining) {
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth() + 1;
    var day = today.getDate();

    if (month < 10) month = "0" + month;
    if (day < 10) day = "0" + day;

    var dataPackage = '{"Sprint":"' + sprint + '","Date":"' + year + '-' + month + '-' + day + 'T00:00:00.000Z","WorkRemaining":' + workRemaining + '}';

    var url = settings.DevStatsBurndownApi;

    $.ajax({
        type: "POST",
        url: url,
        data: dataPackage,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (jsonData) {
            // TODO
        }
    });
}

function CalculateBurndown() {
    var team = GetTeam();
    var dates = GetDateArray();
    var dailyCapacities = GetDailyCapacities(team, dates);
    var today = GetToday();

    var remainingCapacities = [];
    var remainingWork = [];
    
    for (var dateIndex in dates) {
        remainingCapacities.push(0);
        remainingWork.push(workRemainingToday);

        for (var capacityIndex in dailyCapacities) {
            if (parseInt(capacityIndex) <= parseInt(dateIndex)) continue;

            remainingCapacities[dateIndex] += dailyCapacities[capacityIndex];
        }

        for (var burndownDayIndex in burndownHistory.Days) {
            var burndownDay = burndownHistory.Days[burndownDayIndex];

            if (DateToString(burndownDay.Date) == dates[dateIndex])
                remainingWork[dateIndex] = burndownDay.WorkRemaining;
        }
    }

    DrawChart(team, dates, remainingCapacities, remainingWork);
}

function GetToday() {
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth();
    var day = today.getDate();

    return new Date(year, month, day, 0, 0, 0, 0);
}

function DrawChart(team, dates, capacity, workRemaining) {
    CreateChartContainer();

    var today = GetToday();
    var fromLoc = 0;
    var toLoc = 0.5;
    var foundDatePosition = false;
    var title = team.Sprint;
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
                fontSize: '30px'
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
            name: 'Capacity Remaining (End of Day)',
            data: capacity,
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