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
        url: "./Data/SiteSettings.json",
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

    for (var teamIndex in settings.Teams) {
        var teamDetails = settings.Teams[teamIndex];

        var baseFilter = "project: ";
        for (var projectIndex in teamDetails.Projects) {
            if (projectIndex > 0)
                baseFilter += ", ";
            baseFilter += "{" + teamDetails.Projects[projectIndex] + "}";
        }

        baseFilter += " Type: ";
        for (var userStoryIndex in settings.UserStories) {
            if (userStoryIndex > 0)
                baseFilter += ", ";
            baseFilter += "{" + settings.UserStories[userStoryIndex] + "}";
        }

        baseFilter += " State: ";
        for (var stateIndex in settings.DesigningStates) {
            if (stateIndex > 0)
                baseFilter += ", ";
            baseFilter += "{" + settings.DesigningStates[stateIndex] + "}";
        }

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
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Module</th>";
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
        markUp += "<td class='text-cell'>" + youTrackIssue.Title + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Type + "</td>";
        markUp += "<td class='text-cell'>" + youTrackIssue.Subsystem + "</td>";
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