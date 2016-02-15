var sprintStart = new Date(2016, 1, 15, 0, 0, 0, 0);
var sprintLength = 14;
var sprintNumber = 8;

$(document).ready(function () {
    SetRefresh();
    GetYouTrackData();
});

function CreateChartContainer() {
    var chartWidth = window.innerWidth - 20;
    var chartHeight = window.innerHeight - 20;

    if (chartWidth < 100) chartWidth = 100;
    if (chartHeight < 100) chartHeight = 100;

    var markUp = '<div id="container" style="min-width: ' + chartWidth + 'px; height: ' + chartHeight + 'px; margin: 0 auto"></div>';

    $("body").empty();
    $("body").append(markUp);
}

function DrawChart(dates, idealProgress, workingProgress, doneProgress)
{
    CreateChartContainer();

	var today = GetToday();
	var fromLoc = 0;
	var toLoc = 0.5;
	var foundDatePosition = false;
	var title = GetTitleForBoard(dates);
	
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
            min : 0,
            plotLines: [{
                value: 0,
                width: 1,
                color: '#808080'
            }]
        },
        series: [{
            name: 'Ideal',
            data: idealProgress
        }, {
            name: 'Not Started',
            data: workingProgress
        }, {
            name: 'Remaining',
            data: doneProgress
        }]
    });
}

function GetYouTrackData()
{
    var team = GetTeamForBoard();
    var url = "http://172.27.74.34:9111/rest/issue/byproject/CAS?filter=Sprint%3A+%7B" + team + "+" + sprintNumber + "%7D+Type%3A+Task%2C+%7BTesting+Task%7D%2C+%7BProduct+Owner+Review%7D%2C+Merge%2C+%7BRework+Task%7D+order+by%3A+updated+desc&max=200";

	$.ajax({
	    url: url,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function(jsonData) {
            AnalyseYouTrackData(jsonData);
        }
    });
}

function AnalyseYouTrackData(jsonData)
{
    var totalEstimate = 0;
    var dates = GetDatesForSprintAsStrings();
    var doneItems = GetIntegerArray();
    var inProgressItems = GetIntegerArray();
    var doneProgress = GetIntegerArray();
    var idealProgress = GetIntegerArray();
    var workingProgress = GetIntegerArray();
	
	for (var taskLocation in jsonData)
	{
		var task = jsonData[taskLocation];
		var isDone = false;
		var isWorking = false;
		var estimate = 0;
		var doneDate = undefined;
		var inProgressDate = undefined;
		var type = "";
			
		for (var fieldLocation in task.field)
		{
			var field = task.field[fieldLocation];

			if (field.name == "Type")
			{
				type = field.value[0];
			}
			
			if (field.name == "Estimate")
			{
				estimate = parseInt(field.value[0], 0);
			}
			
			if (field.name == "DoneDate")
			{
				doneDate = ConvertYouTrackDate(field.value[0]);
				isDone = true;
			}
			
			if (field.name == "InProgressDate")
			{
				inProgressDate = ConvertYouTrackDate(field.value[0]);
				isWorking = true;
			}
		}

		if (isDone)
		    doneDate = ShiftDateFromWeekendToWeekDay(doneDate);
		if (isWorking)
		    inProgressDate = ShiftDateFromWeekendToWeekDay(inProgressDate);
		if (isDone && IsDateLessThan(doneDate, dates[0]))
		    continue;
		if (isWorking && IsDateLessThan(inProgressDate, dates[0]))
		    inProgressDate = dates[0];

		totalEstimate += estimate;

		for (var loop = 0; loop < dates.length; loop++) {
		    if (isDone && doneDate === dates[loop])
		        doneItems[loop] += estimate;
		    if (isWorking && inProgressDate === dates[loop])
		        inProgressItems[loop] += estimate;
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
	
	DrawChart(dates, idealProgress, workingProgress, doneProgress);
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
    if (navigationParameter != null && navigationParameter === "Yes")
        setTimeout(function () { window.location.replace("YouTrackSummary.html?DisplayIndex=2"); }, 60000);
    else
        setTimeout(function () { window.location.reload(); }, 180000);
}

function GetTeamForBoard() {
    var team = getURLParameter("Team");

    if ((team === null) || (team === undefined))
        team = "Payroll";

    return team;
}

function GetTitleForBoard(dates) {
    var firstDate = dates[0];
    var lastDate = dates[dates.length - 1];

    var firstDay = parseInt(firstDate.substr(0, 2));
    var firstMonth = GetStringDateAsMonthText(firstDate);
    var lastDay = parseInt(lastDate.substr(0, 2));
    var lastMonth = GetStringDateAsMonthText(lastDate);

    var team = GetTeamForBoard();
    var title = team + " Burndown - ";
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

function GetDatesForSprintAsStrings() {
    var dates = [];
    var loop = 0;

    while (dates.length < sprintLength) {
        var thisDate = new Date(sprintStart);
        thisDate.setDate(thisDate.getDate() + loop);

        if ((thisDate.getDay() !== 0) && (thisDate.getDay() !== 6))
            dates.push(DateToString(thisDate));

        loop = loop + 1;
    }

    return dates;
}

function GetIntegerArray() {
    var arrayOfInts = [];

    for (var loop = 0; loop < sprintLength; loop++) {
        arrayOfInts.push(0);
    }

    return arrayOfInts;
}