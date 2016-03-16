var settings = undefined;

$(document).ready(function () {
    SetRefresh();
    ShowBurnDown();
});

function ShowBurnDown() {
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
        }
    });
}

function GetYouTrackData() {
    var teamDetails = GetTeamForBoard();
    var url = "Sprint: {" + teamDetails.Sprint.Name + "} Type: ";

    for (var taskIndex in settings.BurndownTasks) {
        if (taskIndex > 0)
            url += ", ";
        url += "{" + settings.BurndownTasks[taskIndex] + "}";
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
            AnalyseYouTrackData(teamDetails, jsonData);
        }
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

function DrawChart(teamDetails, dates, idealProgress, workingProgress, doneProgress)
{
    CreateChartContainer();

	var today = GetToday();
	var fromLoc = 0;
	var toLoc = 0.5;
	var foundDatePosition = false;
	var title = GetTitleForBoard(teamDetails, dates);
	var lineWidth = 2;

	var urlLineWidth = getURLParameter("LineWidth");
	if (urlLineWidth !== null)
	    lineWidth = parseInt(urlLineWidth);
	
	for (index = 0; index < dates.length; index++)
	{
		if (dates[index] == today)
		{
			fromLoc = index - 0.5;
			toLoc = index + 0.5;
			foundDatePosition = true;
		}
	}
	
	if (!foundDatePosition)
	{
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
	            text: 'Estimation'
	        },
	        min: 0,
	        plotLines: [{
	            value: 0,
	            width: 1,
	            color: '#808080'
	        }]
	    },
	    series: [{
	        name: 'Ideal',
	        data: idealProgress,
	        lineWidth: lineWidth,
	        lineColor: '#3333ff',
	        marker: {
	            fillColor: '#ffffff',
	            lineWidth: 2,
	            lineColor: '#3333ff'
	        }
	    }, {
	        name: 'Not Started',
	        data: workingProgress,
	        lineWidth: lineWidth,
	        lineColor: '#000000',
	        marker: {
	            fillColor: '#ffffff',
	            lineWidth: 2,
	            lineColor: '#000000'
	        }
	    }, {
	        name: 'Remaining',
	        data: doneProgress,
	        lineWidth: lineWidth,
	        lineColor: '#00dd00',
	        marker: {
	            fillColor: '#ffffff',
	            lineWidth: 2,
	            lineColor: '#00dd00'
	        }
	    }]
	});
}

function AnalyseYouTrackData(teamDetails, jsonData)
{
    var totalEstimate = 0;
    var dates = GetDatesForSprintAsStrings(teamDetails);
    var doneItems = GetIntegerArray(teamDetails);
    var inProgressItems = GetIntegerArray(teamDetails);
    var doneProgress = GetIntegerArray(teamDetails);
    var idealProgress = GetIntegerArray(teamDetails);
    var workingProgress = GetIntegerArray(teamDetails);
	
    var youTrackIssues = [];
    var loggedIds = [];

    ConvertYouTrackDataToObjects(jsonData, youTrackIssues, loggedIds);

    for (var issueLocation in youTrackIssues) {
        var youTrackIssue = youTrackIssues[issueLocation];
        var isDone = (youTrackIssue.DoneDate !== undefined);
        var isWorking = (youTrackIssue.InProgressDate !== undefined);
        var doneDate = youTrackIssue.DoneDate;
        var inProgressDate = youTrackIssue.InProgressDate;

		if (isDone)
		    doneDate = ShiftDateFromWeekendToWeekDay(doneDate);
		if (isWorking)
		    inProgressDate = ShiftDateFromWeekendToWeekDay(inProgressDate);
		if (isDone && IsDateLessThan(doneDate, dates[0]))
		    continue;
		if (isWorking && IsDateLessThan(inProgressDate, dates[0]))
		    inProgressDate = dates[0];

		totalEstimate += youTrackIssue.Estimate;

		for (var loop = 0; loop < dates.length; loop++) {
		    if (isDone && doneDate === dates[loop])
		        doneItems[loop] += youTrackIssue.Estimate;
		    if (isWorking && inProgressDate === dates[loop])
		        inProgressItems[loop] += youTrackIssue.Estimate;
		}
	}
	
	for (index = 0; index < doneProgress.length; index++)
	{
		idealProgress[index] = totalEstimate - (index * (totalEstimate / (dates.length -1)));
		doneProgress[index] = totalEstimate;
		workingProgress[index] = totalEstimate;
		for (doneIndex = 0; doneIndex <= index; doneIndex++)
		{
			doneProgress[index] -= doneItems[doneIndex];
			workingProgress[index] -= inProgressItems[doneIndex];
		}
	}
	
	DrawChart(teamDetails, dates, idealProgress, workingProgress, doneProgress);
}

function GetToday()
{
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth()+1; //January is 0!
	var yyyy = today.getFullYear();
	
	if(dd<10) {
		dd='0'+dd
	} 
	
	if(mm<10) {
		mm='0'+mm
	} 
	
	today = dd+'/'+mm+'/'+yyyy;
	
	return today;
}

function IsDateLessThan(toCheck, toCheckAgainst)
{
	var dateToCheck = new Date(toCheck.substr(6, 4) + "-" + toCheck.substr(3, 2) + "-" + toCheck.substr(0, 2));
	var dateToCheckAgainst = new Date(toCheckAgainst.substr(6, 4) + "-" + toCheckAgainst.substr(3, 2) + "-" + toCheckAgainst.substr(0, 2));
	
	return dateToCheck < dateToCheckAgainst;
}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null
}

function ShiftDateFromWeekendToWeekDay(dateToShift)
{
    if (dateToShift == null || dateToShift == "undefined") return dateToShift;

    var dateString = dateToShift.substr(6, 4) + "-" + dateToShift.substr(3, 2) + "-" + dateToShift.substr(0, 2);
    var date = new Date(dateString);

    if (date.getDay() == 0)
        date = date + 1;
    else if (date.getDay() == 6)
        date = date + 2;

    return DateToString(date);
}

function SetRefresh() {
    var navigationParameter = getURLParameter("DoNavigation");
    var currentIndex = getURLParameter("DisplayIndex");
    if (navigationParameter != null && currentIndex != null && navigationParameter === "Yes")
    {
        var url = "YouTrackSummary.html?DisplayIndex=" + currentIndex;
        setTimeout(function () { window.location.replace(url); }, 60000);
    }
    else if (navigationParameter != null && navigationParameter === "Yes")
        setTimeout(function () { window.location.replace("YouTrackSummary.html?DisplayIndex=2"); }, 60000);
    else
        setTimeout(function () { window.location.reload(); }, 180000);
}

function GetTeamForBoard() {
    var teamName = getURLParameter("Team");
    var teamDetails = undefined;

    for (var teamLocation in settings.Teams) {
        if (teamName === settings.Teams[teamLocation].TeamName)
            teamDetails = settings.Teams[teamLocation];
    }

    if (teamDetails === undefined)
        teamDetails = settings.Teams[0]

    return teamDetails;
}

function GetTitleForBoard(teamDetails, dates) {
    var firstDate = dates[0];
    var lastDate = dates[dates.length - 1];

    var firstDay = parseInt(firstDate.substr(0, 2));
    var firstMonth = GetStringDateAsMonthText(firstDate);
    var lastDay = parseInt(lastDate.substr(0, 2));
    var lastMonth = GetStringDateAsMonthText(lastDate);

    var title = teamDetails.TeamName + " Burndown - ";
    title += firstDay + GetDaySuffix(firstDay) + " " + firstMonth;
    title += " to ";
    title += lastDay + GetDaySuffix(lastDay) + " " + lastMonth;

    return title;
}

function GetDaySuffix(day) {
    var stDays = [1, 21, 31];
    var ndDays = [2, 22];

    if (stDays.indexOf(day) >= 0)
        return "st";
    if (ndDays.indexOf(day) >= 0)
        return "nd";
    return "th";
}

function GetDatesForSprintAsStrings(teamDetails) {
    var dates = [];
    var loop = 0;

    while (dates.length < teamDetails.Sprint.DurationDays) {
        var thisDate = new Date(teamDetails.Sprint.StartDate);
        thisDate.setDate(thisDate.getDate() + loop);

        if ((thisDate.getDay() !== 0) && (thisDate.getDay() !== 6))
            dates.push(DateToString(thisDate));

        loop = loop + 1;
    }

    return dates;
}

function GetIntegerArray(teamDetails) {
    var arrayOfInts = [];

    for (var loop = 0; loop < teamDetails.Sprint.DurationDays; loop++) {
        arrayOfInts.push(0);
    }

    return arrayOfInts;
}