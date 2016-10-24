var settings = undefined;
var burndownHistory = undefined;
var youTrackItems = [];
var devStatsComplete = false;

$(document).ready(function () {
    SetRefresh();
    LoadSettings();
});

function SetRefresh() {
    setTimeout(function () { window.location.reload(); }, 300000);
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
    var hoursInDay = parseFloat(settings.HoursInDay);
    var noiseMultiplier = parseFloat(settings.NoiseReduction);

    for (var dateIndex in dates) {
        capacities.push(0);
    }

    for (var resourceIndex in team.Resource) {
        var resource = team.Resource[resourceIndex];
        var dailyCapacity = parseFloat(resource.DailyCapacity) * noiseMultiplier * hoursInDay;

        for (var capacityIndex in capacities) {
            capacities[capacityIndex] = capacities[capacityIndex] + dailyCapacity;
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
    var sprintSearch = CollateSprintText(team.Sprint, false);
    var url = settings.DevStatsBurndownApi + "?sprint=" + encodeURI(sprintSearch);

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
    var team = GetTeam();
    var dates = GetDateArray();
    var dailyCapacities = GetDailyCapacities(team, dates);
    var today = GetToday();
    var latestRemainingCapacity = 0;

    if (burndownHistory.Days.length > 0)
        latestRemainingCapacity = burndownHistory.Days[burndownHistory.Days.length - 1].WorkRemaining;

    var remainingCapacities = [];
    var remainingWork = [];
    
    for (var dateIndex in dates) {
        remainingCapacities.push(0);
        remainingWork.push(latestRemainingCapacity);

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

    var today = DateToString(GetToday());
    var fromLoc = 0;
    var toLoc = 0.5;
    var foundDatePosition = false;
    var title = CollateSprintText(team.Sprint, false);
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

function CollateSprintText(sprints, includeBrackets) {
    var collatedSprints = "";
    var leftBrace = includeBrackets ? "{" : "";
    var rightBrace = includeBrackets ? "}" : "";

    for (var sprintIndex in sprints) {
        collatedSprints += (sprintIndex > 0) ? ", " : "";
        collatedSprints += leftBrace + sprints[sprintIndex] + rightBrace;
    }

    return collatedSprints;
}