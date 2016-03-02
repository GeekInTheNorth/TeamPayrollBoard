﻿var settings = undefined;
var apiStarted = 0;
var apiCompleted = 0;
var issuedLogged = [];
var youTrackIssues = [];

$(document).ready(function () {
    ShowBacklog();
});

function ShowBacklog() {
    $.ajax({
        type: "Get",
        url: "./Data/BacklogParameters.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            GetYouTrackData();
            DisplayDataWhenReady();
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

    baseFilter += " Type: {User Story} ";
//    var firstTaskTypeDone = false;
//    for (var taskIndex in settings.BacklogTypes) {
//        if (firstTaskTypeDone)
//            baseFilter += ", ";
//        else
//            firstTaskTypeDone = true;
//        baseFilter += "{" + settings.BacklogTypes[taskIndex] + "}";
//    }

    baseFilter += " State: ";
    var firstStateDone = false;
    for (var stateIndex in settings.CompletedStates) {
        if (firstStateDone)
            baseFilter += ", ";
        else
            firstStateDone = true;
        baseFilter += "{" + settings.CompletedStates[stateIndex] + "}";
    }

    for (var teamIndex in settings.Teams) {
        var teamDetails = settings.Teams[teamIndex];

        for (var subSystemIndex in teamDetails.SubSystems) {
            var filterText = baseFilter + " Subsystem: {" + teamDetails.SubSystems[subSystemIndex] + "}";
            filterText = encodeURI(filterText);

            var queryText = settings.YouTrackRootUrl + "/rest/issue?filter=" + filterText + "&max=500";
            apiStarted++;

            CallYouTrackApi(queryText, teamDetails.TeamName);
        }
    }
}

function CallYouTrackApi(apiUrl, teamName) {
    $.ajax({
        url: apiUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            ConvertYouTrackDataToObjects(jsonData, youTrackIssues, issuedLogged, teamName);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });
}

function DisplayDataWhenReady() {
    if (apiCompleted === apiStarted) {
        DisplaySummary();
    }
    else {
        setTimeout(function () { DisplayDataWhenReady() }, 1000);
    }
}

function DisplayHeader() {
    var markUp = "<div class='header-bar'>";
    markUp += "<a href='index.html' class='Header-Command'>Home</a>";
    markUp += "<a href='#' onclick='javascript:DisplaySummary();' class='Header-Command'>Summary</a>";
    markUp += "<a href='#' onclick='javascript:RefreshData();' class='Header-Command'>Refresh Data</a>";
    markUp += "</div>";
    $("body").append(markUp);
}

function DisplaySummary() {
    $("body").empty();
    DisplayHeader();

    var tshirtSizes = [];
    tshirtSizes.push("Extra Small (1 Day)");
    tshirtSizes.push("Small (2-5 Days)");
    tshirtSizes.push("Medium (5-10 Days)");
    tshirtSizes.push("Large (11-20 Days)");
    tshirtSizes.push("Extra Large (20+ Days)");

    var summaries = [];
    for (var tshirtIndex in tshirtSizes){
        var summary = new Object();
        summary.TShirtSize = tshirtSizes[tshirtIndex];
        summary.Issues = [];
        summary.TotalActual = 0;
        summary.TotalItems = 0;
        summaries.push(summary);
    }

    for (var youtrackIndex in youTrackIssues) {
        var youTrackItem = youTrackIssues[youtrackIndex];
        if (youTrackItem.TShirtSize === undefined) continue;

        for (var summaryIndex in summaries) {
            var summary = summaries[summaryIndex];
            if (summary.TShirtSize === youTrackItem.TShirtSize) {
                var actualTime = youTrackItem.ActualTime;
                var estimate = youTrackItem.Estimate;

                if ((actualTime === 0) && (estimate > 0))
                    actualTime = estimate;

                summary.TotalActual += actualTime;
                summary.TotalItems += 1;
                summary.Issues.push(youTrackItem);
                break;
            }
        }
    }
    
    var markUp = "<table class='datatable'><tr>";
    markUp += "<th class='text-cell'>T-Shirt Size</th>";
    markUp += "<th class='numeric-cell'>Number Of User Stories</th>";
    markUp += "<th class='numeric-cell'>Total Actual Time (hrs)</th>";
    markUp += "<th class='numeric-cell'>Average Duration (Days)</th>";
    markUp += "</tr>";

    for (var summaryIndex in summaries) {
        var summary = summaries[summaryIndex];
        markUp += "<tr>";
        markUp += "<td class='text-cell'><a href='#' onclick='DisplayBreakDown(\"" + summary.TShirtSize + "\");' class='backlog-command'>" + summary.TShirtSize + "</a></td>";
        markUp += "<td class='numeric-cell'>" + summary.TotalItems + "</td>";
        markUp += "<td class='numeric-cell'>" + summary.TotalActual + "</td>";
        markUp += "<td class='numeric-cell'>" + CalculateAverage(summary.TotalActual, summary.TotalItems) + "</td>";
        markUp += "</tr>";
    }

    markUp += "</table>";

    $("body").append(markUp);
    ShowRowColoursForBreakdowns();
}

function DisplayBreakDown(tshirtSize) {
    $("body").empty();
    DisplayHeader();

    var target = GetTargetValue(tshirtSize);
    var markUp = "<h1>Breakdown for TShirt Size: " + tshirtSize + "</H1>";
    markUp += "<table class='datatable'><tr>";
    markUp += "<th class='text-cell'>Issue Id</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Module</th>";
    markUp += "<th class='numeric-cell'>Estimate (hrs)</th>";
    markUp += "<th class='numeric-cell'>Actual (hrs)</th>";
    markUp += "<th class='numeric-cell'>Actual (Days)</th>";
    markUp += "<th class='text-cell'>On Target</th>";
    markUp += "</tr>";

    for (var youtrackIndex in youTrackIssues) {
        var youTrackIssue = youTrackIssues[youtrackIndex];

        if (youTrackIssue.TShirtSize !== tshirtSize) continue;

        var actualTime = youTrackIssue.ActualTime;
        var estimate = youTrackIssue.Estimate;

        if ((actualTime === 0) && (estimate > 0))
            actualTime = estimate;

        var average = CalculateAverage(actualTime, 1);

        markUp += "<tr>";
        markUp += "<td class='text-cell'><a href='" + settings.YouTrackRootUrl + "/issue/" + youTrackIssue.IssueId + "' target='_blank' class='backlog-command'>" + youTrackIssue.IssueId + "</a></td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Title + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Type + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Subsystem + "</td>";
        markUp += "<td class='numeric-cell'>" + estimate + "</td>";
        markUp += "<td class='numeric-cell'>" + actualTime + "</td>";
        markUp += "<td class='numeric-cell'>" + average + "</td>";
        if (average <= target)
            markUp += "<td class='text-cell'>Yes</td>";
        else
            markUp += "<td class='text-cell bad-cell'>No</td>";
        markUp += "</tr>";
    }

    markUp += "</table>";

    $("body").append(markUp);
    ShowRowColoursForBreakdowns();
}

function CalculateAverage(totalEstimate, totalItems) {
    if (totalItems === 0) return 0;

    var average = totalEstimate / 7 / totalItems;
    average = average * 100;
    average = Math.round(average);
    return average / 100;
}

function GetTargetValue(tshirtSize) {
    if (tshirtSize === "Extra Small (1 Day)") return 1;
    if (tshirtSize === "Small (2-5 Days)") return 5;
    if (tshirtSize === "Medium (5-10 Days)") return 10;
    if (tshirtSize === "Large (11-20 Days)") return 20;
    if (tshirtSize === "Extra Large (20+ Days)") return 30;

    return 0;
}