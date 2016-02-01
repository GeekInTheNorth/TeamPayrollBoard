var settings = undefined;
var apiStarted = 0;
var apiCompleted = 0;
var issuedLogged = [];
var youTrackIssues = [];

$(document).ready(function () {
    ShowBacklog();
});

function RefreshData() {
    ShowBacklog();
}

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

    baseFilter += " Type: ";
    var firstTaskTypeDone = false;
    for (var taskIndex in settings.BacklogTypes) {
        if (firstTaskTypeDone)
            baseFilter += ", ";
        else
            firstTaskTypeDone = true;
        baseFilter += "{" + settings.BacklogTypes[taskIndex] + "}";
    }

    baseFilter += " State: ";
    var firstStateDone = false;
    for (var stateIndex in settings.DesigningStates) {
        if (firstStateDone)
            baseFilter += ", ";
        else
            firstStateDone = true;
        baseFilter += "{" + settings.DesigningStates[stateIndex] + "}";
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
            ConvertYouTrackDataToObjects(jsonData, teamName);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });
}

function ConvertYouTrackDataToObjects(jsonData, teamName) {
    for (var taskLocation in jsonData.issue) {
        var task = jsonData.issue[taskLocation];
        var state = undefined;
        var type = undefined;
        var title = undefined;
        var subSystem = undefined;
        var issueId = task.id;
        var estimate = 0;
        var hasRequiresTaskingTag = false;
        var hasRequiresTestingTag = false;
        var hasRequiresPOReview = false;

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

            if (field.name === "summary") {
                title = field.value;
            }

            if (field.name === "Subsystem") {
                subSystem = field.value[0];
            }

            if (field.name === "Estimate") {
                estimate = field.value[0];
            }
        }

        for (var tagIndex in task.tag) {
            var tagValue = task.tag[tagIndex].value;
            if (tagValue === "Needs Testing Tasks") hasRequiresTestingTag = true;
            if (tagValue === "Req. PO Review") hasRequiresPOReview = true;
            if (tagValue === "Needs Tasking Out") hasRequiresTaskingTag = true;
        }

        var taskObject = new Object();
        taskObject.Type = type;
        taskObject.State = state;
        taskObject.Title = title;
        taskObject.IssueId = issueId;
        taskObject.Subsystem = subSystem;
        taskObject.Team = teamName;
        taskObject.Estimate = estimate;
        taskObject.NeedsPOReview = hasRequiresPOReview;
        taskObject.NeedsTestingTasks = hasRequiresTestingTag || hasRequiresTaskingTag || (estimate <= settings.MergeAndPOReviewDuration);
        taskObject.NeedsDevTasks = hasRequiresTaskingTag || (estimate <= settings.MergeAndPOReviewDuration);

        youTrackIssues.push(taskObject);
    }
}

function DisplayDataWhenReady() {
    if (apiCompleted === apiStarted) {
        DisplaySummary();
    }
    else {
        setTimeout(function () { DisplayDataWhenReady() }, 1000);
    }
}

function DisplaySummary() {
    $("body").empty();
    SetHeader();

    var markUp = "<H1>Backlog Summary</H1><table class='datatable'>";
    markUp += "<tr><th class='text-cell'>Team</th><th class='numeric-cell'>Number of Items</th><th class='numeric-cell'>Requiring Tasking Out</th><th class='numeric-cell'>Tasked Out</th><th class='numeric-cell'>Requiring PO Review</th></tr>";

    for (var teamIndex in settings.Teams) {
        var teamDetails = settings.Teams[teamIndex];
        var itemsPending = 0;
        var itemsNeedingTasks = 0;
        var itemsReady = 0;
        var itemsNeedPOReview = 0;
        var itemsTaskedOut = 0;
        var totalEstimate = 0;

        for (var youTrackIssueIndex in youTrackIssues) {
            var youTrackIssue = youTrackIssues[youTrackIssueIndex];

            if (youTrackIssue.Team !== teamDetails.TeamName) continue;

            itemsPending += 1;
            
            if (youTrackIssue.NeedsTestingTasks || youTrackIssue.NeedsDevTasks)
                itemsNeedingTasks += 1;
            else
                totalEstimate += parseInt(youTrackIssue.Estimate);

            if (youTrackIssue.NeedsPOReview)
                itemsNeedPOReview += 1;
        }

        itemsTaskedOut = itemsPending - itemsNeedingTasks;

        markUp += "<tr>";
        markUp += "<td class='text-cell'>" + teamDetails.TeamName + "</td>";
        markUp += "<td class='numeric-cell'><a href='#' class='backlog-command' data-teamname='" + teamDetails.TeamName + "' data-filtertype='ALL'>" + itemsPending + "</a></td>";
        markUp += "<td class='numeric-cell'><a href='#' class='backlog-command' data-teamname='" + teamDetails.TeamName + "' data-filtertype='NeedsTasks'>" + itemsNeedingTasks + "</a></td>";
        markUp += "<td class='numeric-cell'><a href='#' class='backlog-command' data-teamname='" + teamDetails.TeamName + "' data-filtertype='HasTasks'>" + itemsTaskedOut + " (" + totalEstimate + " hours)</a></td>";
        markUp += "<td class='numeric-cell'><a href='#' class='backlog-command' data-teamname='" + teamDetails.TeamName + "' data-filtertype='NeedsPOReview'>" + itemsNeedPOReview + "</a></td>";
        markUp += "</tr>";
    }

    $("body").append(markUp);
    $("a.backlog-command").click(function () {
        var teamName = $(this).data('teamname');
        var filterType = $(this).data('filtertype');

        ShowTeamBreakdownFor(teamName, filterType);
    });

    ShowRowColoursForBreakdowns();
}

function SetHeader() {
    var markUp = "<div class='header-bar'>";
    markUp += "<a href='index.html' class='Header-Command'>Home</a>";
    markUp += "<a href='#' onclick='javascript:DisplaySummary();' class='Header-Command'>Summary</a>";
    markUp += "<a href='#' onclick='javascript:RefreshData();' class='Header-Command'>Refresh Data</a>";
    markUp += "</div>";
    $("body").append(markUp);
}

function ShowTeamBreakdownFor(teamName, filterType) {
    $("body").empty();
    SetHeader();

    var markUp = "<H1>" + teamName + " Backlog Breakdown</H1>";
    markUp += "<table class='datatable'>";
    markUp += "<tr>";
    markUp += "<th class='text-cell'>Issue Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Needs Dev Tasks</th>";
    markUp += "<th class='text-cell'>Needs Testing Tasks</th>";
    markUp += "<th class='numeric-cell'>Estimate</th>";
    markUp += "</tr>";

    for (var issueIndex in youTrackIssues) {
        var youTrackIssue = youTrackIssues[issueIndex];

        if (youTrackIssue.Team !== teamName) continue;
        if ((filterType === "NeedsPOReview") && !youTrackIssue.NeedsPOReview) continue;
        if ((filterType === "NeedsTasks") && !youTrackIssue.NeedsDevTasks && !youTrackIssue.NeedsTestingTasks) continue;
        if ((filterType === "HasTasks") && (youTrackIssue.NeedsDevTasks || youTrackIssue.NeedsTestingTasks)) continue;

        markUp += "<tr>";
        markUp += "<td class='text-cell'><a href='" + settings.YouTrackRootUrl +"/issue/" + youTrackIssue.IssueId + "' target='_blank'>" + youTrackIssue.IssueId + "</a></td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Type + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Title + "</td>";
        markUp += "<td class='text-cell'>" + BoolToString(youTrackIssue.NeedsDevTasks) + "</td>";
        markUp += "<td class='text-cell'>" + BoolToString(youTrackIssue.NeedsTestingTasks) + "</td>";
        markUp += "<td class='numeric-cell'>" + youTrackIssue.Estimate + "</td>";
        markUp += "</tr>";
    }
    markUp += "</table>";

    $("body").append(markUp);
    ShowRowColoursForBreakdowns();
}

function BoolToString(boolValue) {
    if (boolValue)
        return "Yes";
    return "No";
}