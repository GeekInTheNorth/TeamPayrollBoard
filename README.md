Youtrack Information Radiator
=============================

An Information Radiator for my development team "Team Payroll".  We use Youtrack as a Kanban board and for tracking pieced of work on and off the board which is then in connected to Team City and a private Git server.

While Youtrack is great for getting an overall feel for where we are, I wanted an information radiator (screen) that would tell me a few key pieces of information that were really easy to read:

* Which patches have made progress recently
* How many patches are in each state
* How many we have remaining to sign off

CONFIGURATION
=============

In order to use this web application you need to configure Youtrack to allow Guest access by following these steps:

* Log into Youtrack as an administrator
* Go to Administration
* Click on the Settings link
* Scroll down to Users and tick Guest Account and then click save
* Optionally click Manage Guest Permissions to ensure the guest account can see the data you want to report on

Inside the Data folder for this website is a file named "Configuration.json.template".  Rename this file to remove the ".template" extension.

Edit the Configuration.json file and add an entry into the States collection for each Youtrack state you wish to display.  There is no limit on the number of states that can be displayed, however the collection in the json file should be in the same order as you wish to see them on screen.  Here is an example from my configuration file:

```javascript
{
	"DisplayName": "Func. Testing - Done",
	"Name": "Functional Testing - Done"
}
```

Edit the Configuration.json file and add an entry into Screens for set of information you wish to display.  There is no limit to the number of screens that can be displayed.  Here is an example from my configuration file:

```javascript
"Screens": [
		{
			"DisplayName": "Team Payroll - Latest Items",
			"DataType": "ItemList",
			"Url": "http://YouTrackUrl/rest/issue/byproject/PY?filter=project%3A+Payroll+State%3A+%7BDesigning%7D+..+%7BProduct+Owner+Review%7D+order+by%3A+updated+desc&max=6"
		},
		{
			"DisplayName": "Team Payroll - Development",
			"DataType": "StateCounts",
			"Url": "http://YouTrackUrl/rest/issue/byproject/PY?filter=project%3A+Payroll+Payroll+Board%3A+5.3+State%3A+%7BDesigning%7D+..+%7BComplete%7D+Regression%3A+No+order+by%3A+updated+desc&max=100"
		},
		{
			"DisplayName": "Upcoming Events",
			"DataType": "Events",
			"Url": "./Data/Events.json",
			"NumberOfItems": "8"
		},
		{
			"DisplayName": "Messages",
			"DataType": "Messages",
			"Url": "./Data/Messages.json"
		},
		{
			"DisplayName": "Burndown",
			"DataType": "Navigation",
			"Url": "./burndown.html"
		}
	]
```

There are four DataType values that decide how data is rendered in the summary:

* A DataType of ItemList will display a summary of each Youtrack item in the list.  I set my Youtrack filter to order by the updated field in descending order and I added "&max=6" to limit the number of issues to display on this summary screen.
* A DataType of StateCounts will count just the items at each state and display the state's DisplayName and the number of items.  I added "&max=100" to limit the results from youtrack, not because I expect a hundred items, but because by default it returns only a smaller number of items than I needed to have counted.
* A DataType of Events will display a list of dates and descriptions provided in another json file.  In the example above I reference an Events.json from inside the website and I have configured the screen to display only 8 items, the webpage will then only display the first 8 items on or after today.
* A DataType of Navigation will allow you to add any custom navigation page.  That page will have to return to the YouTrackSummary page to keep the cycle going.  To continue with the next step in the order of displayed data, provide DisplayIndex in the query string when redirecting back to YouTrackSummary.html.

To configure the Events data, rename the ./Data/Events.json.template to remove the template extension and then replace the examples with events of your own.

```javascript
{
	"Events": [
		{ "Date": "2014-10-28", "Event": "Example Event Text 1" },
		{ "Date": "2014-11-03", "Event": "Example Event Text 2" }
	]
}
```

To configure the Messages data, rename the ./Data/Messages.json.template to remove the template extension and then replace the examples with events of your own.

```javascript
{
	"Messages": [
		{ "Message" : "Message Example 1" },
		{ "Message" : "Message Example 2" }
	]
}
```

The refresh rate can also be set for the webpage.  This is measured in milliseconds and is set in Configuration.json under the aptly named RefreshRate key.

The Burndown Chart and the Defect Log are both standalone pages.  Both contain a significant amount of javascript to make them work, so it was cleaner to keep them separate.  To add them to the Configuration.json file, they must be added as DataType of "Navigation". 
The Defect Log has it's own configuration file, a template has been added to this repository for it.  The following is an example of how to configure it:

```javascript
{
  "ScreenDuration": "60000",
  "NextScreenUrl": "./YouTrackSummary.html?DisplayIndex=3",
  "YouTrackQueryUrl": "http://YouTrackUrl/rest/issue/byproject/CAS?filter=project%3A+CAS+Type%3A+%7BRework+Task%7D+%2C+Bug+%2C+Defect+created%3A+2015-01+..+Today+or+project%3A+PY%2C+HR+Type%3A+Bug+created%3A+2015-01+..+Today+order+by%3A+created+desc&max=5000",
  "ReworkTypes": [
    "Rework Task"
  ],
  "DefectTypes": [
    "Bug",
    "Defect"
  ]
}
```

When adding the url for the Burndown Chart or the Defect Log to the Configuration.json, ensure that a query string of "DoNavigation=Yes" is included.  If this isn't included then these pages will not navigate back to the YouTrackSummary page.

DONE
====

last Updated 15/02/2016

* Display an error message when failing to connect to Youtrack
* Show Summary Titles based on configured data
* Removed place-holders for Days In Sprint numbers since they were not operable yet
* Displayed Item Counts and Latest Items separately on a rotating cycle
* Retitle to something less tied to my Dev. Team.
* Clean up classes and styles
* Implement a How to Use
* Template the Configuration.json
* Make the totals count a different colour to the other counts
* Removed the need to configure the number of screens to cycle through
* Added the ability to list a number of events
* Added the ability to configure the refresh rate for the page.
* Removed the float from the title that could sometimes result in items being displayed to the right of the title box.
* Changed logic for turning Youtrack milliseconds into a date and time
* Added the ability to display a list of messages in a json file
* Allow the Refresh time to be configured
* Implemented a Burndown Chart
* Implemented a Defect Report
* Added the ability to start the YouTrackSummary page from a certain index
* Added the ability to track developer and team stats
* Added the ability to track Estimation Accuracy
* Added the ability to monitor the backlog