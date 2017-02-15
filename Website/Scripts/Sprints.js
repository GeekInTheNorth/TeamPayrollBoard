var apiRoot = "http://cascadedevstats.azurewebsites.net/api/";

$(document).ready(function () {
    LoadSprints();
});

function LoadSprints() {
    var url = apiRoot + "Sprint";

    $.ajax({
        type: "Get",
        url: url,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            DisplaySprints(jsonData);
        }
    });
}

function DisplaySprints(sprints) {
    var markUp = "<table class='datatable'>";
    markUp += "<tr>"
    markUp += "<th class='text-cell'>Team</th>";
    markUp += "<th class='text-cell'>Sprint</th>";
    markUp += "<th class='numeric-cell'>Start Date</th>"
    markUp += "<th class='numeric-cell'>Duration (days)</th>"
    markUp += "<th class='numeric-cell'>Planned Effort</th>"
    markUp += "<th class='text-cell'>Actions</th>";
    markUp += "</tr>";

    for (var sprintIndex in sprints) {
        var sprint = sprints[sprintIndex];
        markUp += "<tr>";
        markUp += "<td class='text-cell'>" + sprint.Pod + "</td>";
        markUp += "<td class='text-cell'>" + sprint.Name + "</td>";
        markUp += "<td class='numeric-cell'>" + DateToString(sprint.StartDate) + "</td>";
        markUp += "<td class='numeric-cell'>" + sprint.DurationDays + "</td>";
        markUp += "<td class='numeric-cell'>" + sprint.PlannedEffort + "</td>";
        markUp += "<td class='text-cell'><a href='Burndown.html?Team=" + encodeURI(sprint.Pod) + "&sprint=" + encodeURI(sprint.Name) + "'>[View Burndown]</a>"
        markUp += "</tr>";
    }
    markUp += "</table>";

    $("body").empty();
    $("body").append(markUp);
    ShowRowColoursForBreakdowns();
}