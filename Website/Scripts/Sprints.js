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
    var markUp = "<a class='add-button'>Add Sprint</a>";
    markUp += "<table class='datatable'>";
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
        markUp += "<td class='text-cell'>"
        markUp += "<a href='Burndown.html?Team=" + encodeURI(sprint.Pod) + "&sprint=" + encodeURI(sprint.Name) + "'>[View Burndown]</a>";
        markUp += "<a href='#' class='edit-button' data-pod='" + encodeURI(sprint.Pod) + "' data-sprint='" + encodeURI(sprint.Name) + "' data-start='" + encodeURI(sprint.StartDate) + "' data-durationdays='" + sprint.DurationDays + "' data-plannedeffort ='" + sprint.PlannedEffort + "'>[Edit]</a>";
        markUp += "</td>";
        markUp += "</tr>";
    }
    markUp += "</table>";

    $("body").empty();
    $("body").append(markUp);
    ShowRowColoursForBreakdowns();

    $("a.edit-button").click(function () {
        DisplaySprintEdit(this);
    });

    $("a.add-button").click(function () {
        DisplaySprintInsert();
    });
}

function DisplaySprintInsert() {
    CreateSprintSettingsForm("", "", new Date(), 0, 0, false);
}

function DisplaySprintEdit(linkButton) {
    var pod = decodeURI($(linkButton).data("pod"));
    var sprintName = decodeURI($(linkButton).data("sprint"));
    var startDate = $(linkButton).data("start");
    var durationDays = $(linkButton).data("durationdays");
    var plannedEffort = $(linkButton).data("plannedeffort");

    CreateSprintSettingsForm(pod, sprintName, startDate, durationDays, plannedEffort, true);
}

function CreateSprintSettingsForm(pod, sprintName, startDate, durationDays, plannedEffort, isEdit) {
    $("body").empty();
    var markUp = "<form>"
    markUp += "<table class='datatable'>";
    markUp += "<tr><td>Team</td><td>";
    markUp += "<select id='ddlTeam'>";
    markUp += "<option value='Cobra'>Cobra</option>";
    markUp += "<option value='Rhino'>Rhino</option>";
    markUp += "<option value='Rocket'>Rocket</option>";
    markUp += "<option value='Wolf'>Wolf</option>";
    markUp += "</select>";
    markUp += "</td></tr>";
    markUp += "<tr><td>Sprint</td><td><input type='text' id='txtSprint'></td></tr>";
    markUp += "<tr><td>Start Date</td><td><input type='date' id='txtDate'></td></tr>";
    markUp += "<tr><td>Duration (days)</td><td><input type='number' step='1' id='txtDurationDays'></td></tr>";
    markUp += "<tr><td>Planned Effort</td><td><input type='number' step='1' id='txtPlannedEffort'></td></tr>";
    markUp += "</table>";
    markUp += "<br/>"
    markUp += "<a class='save-button'>Save</a>&nbsp;<a class='cancel-button'>Cancel</a>"
    markUp += "</form>"

    var sprintStartDate = new Date(startDate);
    var day = ("0" + sprintStartDate.getDate()).slice(-2);
    var month = ("0" + (sprintStartDate.getMonth() + 1)).slice(-2);
    var dateForControl = sprintStartDate.getFullYear() + "-" + month + "-" + day;

    $("body").append(markUp);
    $("#ddlTeam").val(pod);
    $("input#txtSprint").val(sprintName);
    $("input#txtDate").val(dateForControl);
    $("input#txtDurationDays").val(durationDays);
    $("input#txtPlannedEffort").val(plannedEffort);

    if (isEdit) {
        $("#ddlTeam").prop("disabled", true);
        $("input#txtSprint").prop("disabled", true);
    }

    $("a.save-button").click(function () {
        SaveSprint();
    });

    $("a.cancel-button").click(function () {
        LoadSprints();
    });
}

function SaveSprint() {
    var pod = $("#ddlTeam").val();
    var sprintName = $("input#txtSprint").val();
    var startDate = $("input#txtDate").val();
    var durationDays = $("input#txtDurationDays").val();
    var plannedEffort = $("input#txtPlannedEffort").val();

    var sprintStartDate = new Date(startDate);
    var day = ("0" + sprintStartDate.getDate()).slice(-2);
    var month = ("0" + (sprintStartDate.getMonth() + 1)).slice(-2);
    var dateForControl = sprintStartDate.getFullYear() + "-" + month + "-" + day + "T00:00:00.000Z";

    var objectToSave = new Object();
    objectToSave.Pod = pod;
    objectToSave.Name = sprintName;
    objectToSave.StartDate = dateForControl;
    objectToSave.DurationDays = durationDays;
    objectToSave.PlannedEffort = plannedEffort;

    var dataPackage = JSON.stringify(objectToSave);
    var postUrl = apiRoot + "Sprint";

    $.ajax({
        type: "POST",
        url: postUrl,
        data: dataPackage,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (jsonData) {
            LoadSprints();
        },
        error: function (jsonData) {
            LoadSprints();
        }
    });
}