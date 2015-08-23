function MelTask(taskList, googleSheetJsonRecord) {
  this.taskList = taskList;
  this.taskFields = ["set", "id", "dependency", "type", "experiment", "name", "description", "results", "responsible", "control", "status", "starttime", "endtime", "totaltime"];
  this.taskAdditionalFields = ["blockedby", "index", "shortstring", "checkitemsstring", "experimentid", "setnumber", "setid", "responsiblerole"];
  for (var i=0; i<this.taskFields.length; i++) {
    var field = this.taskFields[i];
    this[field] = googleSheetJsonRecord["gsx$"+field]["$t"];
  }
}

MelTask.prototype.isDone = function() {
  return this.status=="done";
}

//Populates HTML elements with class="field_xxx" with content of task property xxx, for all task properties
MelTask.prototype.populateTaskData = function(container) {
  for (var i=0; i<this.taskFields.length; i++) {
    var field = this.taskFields[i];
    $(container).find(".field_"+field).html(this[field]);
  }
  for (var i=0; i<this.taskAdditionalFields.length; i++) {
    var field = this.taskAdditionalFields[i];
    $(container).find(".field_"+field).html(this[field]);
  }
}

MelTask.prototype.getShortString = function() {
  var experimentStr = "";
  if (this.experiment!="") {
    experimentStr = " [" + this.experiment + "]";
  }
  return "#" + this.id + " " + this.name + experimentStr + " - " + this.responsible;
}

MelTask.prototype.isReadyToStart = function() {
  var allDepReady = true;
  for (var i=0; i<this.dependency.length; i++) {
    var dep = this.dependency[i];
    if (dep!=null) {
      if (!dep.isDone()) { 
        allDepReady = false;
      }
    }
  }
  return allDepReady;
}

MelTask.prototype.getTasksReleasedAfterThatIsDone = function() {
  var arr = [];

  for (var i=0; i<this.taskList.length; i++) {
    var task = this.taskList[i];
    if (!task.isDone()) {
      var dependsOnThatTask = false;
      var dependsOnOtherNotDone = false;

      for (var j=0; j<task.dependency.length; j++) {
        var dep = task.dependency[j];
        if (dep==this) {
          dependsOnThatTask = true;
        } else {
          if (!dep.isDone()) {
            dependsOnOtherNotDone = true;
          }
        }
      }

      if (dependsOnThatTask && !dependsOnOtherNotDone) {
        arr.push(task);
      }
    }
  }

  return arr;
}

MelTask.prototype.getDescriptionOfTasksBlockingThis = function() {
  var blockedStr = "";
  for (var j=0; j<this.dependency.length; j++) {
    var dep = this.dependency[j];
    if (!dep.isDone()) {
      blockedStr = blockedStr + dep.shortstring + "<br>";
    }
  }
  return blockedStr;
}


////////////////////////////////////////////////////////////////
// TaskList - list of tasks
////////////////////////////////////////////////////////////////

function MelTaskList(googleSheetJson) {
  this.tasks = [];
  for (var i=0; i<googleSheetJson.feed.entry.length; i++) {
    this.tasks[i] = new MelTask(this.tasks, googleSheetJson.feed.entry[i]);
  }
  this.processTasks();
}

MelTaskList.prototype.processTasks = function() {
  //First passage
  for (var i=0; i<this.tasks.length; i++) {
    var task = this.tasks[i];
    this.processTaskDependency(task);
    task.index = i+2;
    task.shortstring = task.getShortString();
    task.setnumber = melSets[task.set].number;
    task.setid = melSets[task.set].id;
    task.responsiblerole = task.responsible;
    task.responsible = melRoles.getResponsible(task.set, task.responsible);
    task.responsiblerole = task.responsiblerole + " (" + task.responsible + ")";
    task.results = task.results.replace(/<set_innertitle>/g, task.set).replace(/<experiment_innertitle>/g, task.experiment);

    //Add experiment id 
    var e = melExperiments.getExperimentByInnerTitle(task.experiment);
    if (e==null) {
      task.experimentid = "";
    } else {
      task.experimentid = e.id;
    }

    //Add check items
    task.checkitems = melChecklists.getCheckItems(task.id);
    task.checkitemsstring = "";
    for (var j=0; j<task.checkitems.length; j++) {
      task.checkitemsstring += "<li>" + task.checkitems[j].getString(task) + "</li>";
    }
  }

  //Second passage
  for (var i=0; i<this.tasks.length; i++) {
    var task = this.tasks[i];
    task.blockedby = task.getDescriptionOfTasksBlockingThis(); 
  }
}

MelTaskList.prototype.processTaskDependency = function(task) {
  var arrDepTasks = [];
  var arrDepIds = task.dependency.split(", ");
  for (var j=0; j<arrDepIds.length; j++) {
    var id = arrDepIds[j];
    $.merge(arrDepTasks, this.getTaskById(id, task.set, task.experiment));
  }
  task.dependency = arrDepTasks;
}

//This function can return either one tasks or several tasks if experiment is not set
MelTaskList.prototype.getTaskById = function(id, set, experiment) {
  var arr = [];
  for (var i=0; i<this.tasks.length; i++) {
    var task = this.tasks[i];                                                                      
    if (task.id==id && 
        task.set==set && 
        (experiment=="" || task.experiment=="" || task.experiment==experiment)
    ) {
      arr.push(task);
    }
  }
  return arr;
}

////////////////////////////////////////////////////////////////
// MelFilter - tasks filter system
////////////////////////////////////////////////////////////////

function MelFilter() {
  this.set = $.cookie("filter_set");
  this.responsible = $.cookie("filter_responsible");
  if (typeof this.set == "undefined") {
    this.set = "";
  }
  if (typeof this.responsible == "undefined") {
    this.responsible = "";
  }
  this.setOptions = [];
  this.responsibleOptions = []
  if (location.hash!="") {
    var arr = location.hash.substring(1).split("-");
    this.set = arr[0];
    this.responsible = arr[1];
    $.cookie("filter_set", this.set);
    $.cookie("filter_responsible", this.responsible);
  } else {
    this.updateUrlAddress();
  }
}

MelFilter.prototype.updateUrlAddress = function() {
  location.hash = [this.set, this.responsible].join("-");
}

MelFilter.prototype.forceCertainSetSelected = function() {
  if (this.set=="") {
    this.set = this.setOptions[0];
    $.cookie("filter_set", this.set);
    this.updateUrlAddress();
  }
}

MelFilter.prototype.forceCertainResponsibleSelected = function() {
  if (this.responsible=="") {
    this.responsible = this.responsibleOptions[0];
    $.cookie("filter_responsible", this.responsible);
    this.updateUrlAddress();
  }
}

MelFilter.prototype.isTaskMatched = function(task) {
  return (this.responsible=="" || task.responsible==this.responsible) &&
         (this.set=="" || task.set==this.set);
}

MelFilter.prototype.fillOptionsFromTasks = function(tasks) {
  function convertOptionHashToArray(optionHash) {
    var options = [];
    for (var option in optionHash) {
      if (optionHash.hasOwnProperty(option)) {
        options.push(option);
      }
    }
    return options;
  }

  var setsOptionsHash = {};
  var responsiblesOptionsHash = {};
  for (var i=0; i<tasks.length; i++) {
    var task = tasks[i];
    setsOptionsHash[task.set] = 1;
    responsiblesOptionsHash[task.responsible] = 1;
  }
  this.setOptions = convertOptionHashToArray(setsOptionsHash);
  this.responsibleOptions = convertOptionHashToArray(responsiblesOptionsHash);
}

MelFilter.prototype.populateSelectOptions = function(selectId, options, currentOption, includeAllOption) {
  var select = document.getElementById(selectId);

  if (includeAllOption) {
    var opt = document.createElement("option");
    opt.value = "All";
    opt.innerHTML = "All";
    if (typeof selectedElement === "undefined" || selectedElement=="" || selectedElement==null) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }

  //Adding other options
  for (var i=0; i<options.length; i++) {
    var option = options[i];
    var opt = document.createElement("option");
    opt.value = option;
    opt.innerHTML = option;
    if (option==currentOption) {
      opt.selected = true;
    }
    select.appendChild(opt);
  }
}

MelFilter.prototype.populateSetOptions = function(setSelectId, callbackContentRefresh, includeAllOption) {
  this.populateSelectOptions(setSelectId, this.setOptions, this.set, includeAllOption);

  $("#"+setSelectId).on("change", function() {
    if (""+this.value=="All") {
      melFilter.set = "";
    } else {
      melFilter.set = ""+this.value;
    }
    $.cookie("filter_set", melFilter.set);
    callbackContentRefresh();
    melFilter.updateUrlAddress();
  });
}

MelFilter.prototype.populateResponsibleOptions = function(setSelectId, callbackContentRefresh, includeAllOption) {
  this.populateSelectOptions(setSelectId, this.responsibleOptions, this.responsible, includeAllOption);

  $("#selection_responsible").on("change", function() {
    if (""+this.value=="All") {
      melFilter.responsible = "";
    } else {
      melFilter.responsible = ""+this.value;
    }
    $.cookie("filter_responsible", melFilter.responsible);
    callbackContentRefresh();
    melFilter.updateUrlAddress();
  });
}

var melFilter = new MelFilter();


////////////////////////////////////////////////////////////////
// MelPeople - list of roles and people responsible for the tasks
////////////////////////////////////////////////////////////////

function MelPeople(googleSheetJson) {
  this.people = [];
  for (var i=0; i<googleSheetJson.feed.entry.length; i++) {
    var entry = googleSheetJson.feed.entry[i];
    var person = {};
    person.name = entry["gsx$"+"name"]["$t"];
    person.email = entry["gsx$"+"email"]["$t"];
    person.id = entry["gsx$"+"id"]["$t"];
    this.people.push(person);
  }
}

MelPeople.prototype.find = function(personId) {
  for (var i=0; i<this.people.length; i++) {
    var person = this.people[i];
    if (person.id==personId) {
      return person;
    }
  }
  console.log("Error. Person [" + personId + "] is not found");
  return null;
}

MelPeople.prototype.sendTaskStatusEmailToVassili = function(task, status) {
  var releasedTasks = task.getTasksReleasedAfterThatIsDone();
  var strReleasedTasks = "";
  for (var i=0; i<releasedTasks.length; i++) {
    strReleasedTasks = strReleasedTasks + releasedTasks[i].getShortString() + "<br>"
  }
  
  $.ajax({
    type: 'POST',
    url: 'https://mandrillapp.com/api/1.0/messages/send.json',
    data: {
      'key': 'Tge2LRQL1Hk4rlhPes7qwQ',
      'message': {
        'from_email': 'robot@melscience.com',
        'to': [
            {
              'email': "vassili@melscience.com",
              'name': "Vassili Philippov",
              'type': 'to'
            }
          ],
        'autotext': 'true',
        'subject': status + ': ' + task.shortstring + " '" + task.set + "'",
        'html': '<h1>#' + task.id + " " + task.name + " [" + task.experiment + "]</h1>" +  
                "<br>Description: " + task.description + 
                "<br>Results: " + task.results + 
                "<br>Responsible: " + task.responsible + 
                "<br>Google Sheet Row #: " + task.index + 
                "<br><br>Released tasks:<br>" + strReleasedTasks +
                "<br><br><a href='internal.melscience.com/melchemistryprocess/'>MEL Chemistry process page</a>" + 
                "<br><a href='https://docs.google.com/spreadsheets/d/1WqwknAu_mwQfkDtP4UcGZAix2zBwqUmp3A8XX5xUto8/edit#gid=448918918'>Google Sheet</a>"
      }
    }
   }).done(function(response) {
     console.log(response); // if you're into that sorta thing
 });
}

MelPeople.prototype.sendTaskFinishEmailToVassili = function(task) {
  this.sendTaskStatusEmailToVassili(task, "Done task");
}

MelPeople.prototype.sendTaskStartEmailToVassili = function(task) {
  this.sendTaskStatusEmailToVassili(task, "Start task");
}

MelPeople.prototype.sendEmail = function(personId, task) {
  var person = this.find(personId);
  if (person==null) {
    alert("Error sending email. Person '" + personId + "' is not found");
  }
  console.log("Sending email. Subject='" + "Next task: " + task.shortstring + "' to " + person.email);
  $.ajax({
    type: 'POST',
    url: 'https://mandrillapp.com/api/1.0/messages/send.json',
    data: {
      'key': 'Tge2LRQL1Hk4rlhPes7qwQ',
      'message': {
        'from_email': 'robot@melscience.com',
        'to': [
            {
              'email': person.email,
              'name': person.name,
              'type': 'to'
            }
          ],
        'autotext': 'true',
        'subject': 'Next task: ' + task.shortstring,
        'html': '<h1>#' + task.id + " " + task.name + " [" + task.experiment + "]</h1>" +  
                "<br>Description: " + task.description + 
                "<br>Results: " + task.results + 
                "<br><br><a href='internal.melscience.com/melchemistryprocess/'>MEL Chemistry process page</a>" + 
                "<br><a href='https://docs.google.com/spreadsheets/d/1WqwknAu_mwQfkDtP4UcGZAix2zBwqUmp3A8XX5xUto8/edit#gid=448918918'>Google Sheet</a>"
      }
    }
   }).done(function(response) {
     console.log(response); // if you're into that sorta thing
 });
}

function importMelPeople(googleSheetJson) {
  melPeople = new MelPeople(googleSheetJson);
}

var melPeople = null;

////////////////////////////////////////////////////////////////
// MelTaskTimer
////////////////////////////////////////////////////////////////

function MelTaskTimer() {
  this.paused = false;
  this.previousInternalsTimeInSeconds = 0;
}

MelTaskTimer.prototype.start = function() {
  this.previousInternalsTimeInSeconds = 0;
  this.startTime = new Date(); 
  this.paused = true;
  this.startInterval();
} 

MelTaskTimer.prototype.finish = function() {
  this.finishInterval();
  this.finishTime = new Date(); 
} 

MelTaskTimer.prototype.startInterval = function() {
  if (this.paused) {
    this.paused = false;
    this.lastStartTime = new Date(); 
  }
} 

MelTaskTimer.prototype.finishInterval = function() {
  if (!this.paused) {
    this.paused = true;
    var curTime = new Date();
    var secondsInLastInterval = Math.floor((curTime.getTime()-this.lastStartTime.getTime())/1000);
    this.previousInternalsTimeInSeconds += secondsInLastInterval;
  }
} 

MelTaskTimer.prototype.getPassedSeconds = function() {
  var seconds = this.previousInternalsTimeInSeconds;
  if (!this.paused) {
    var curTime = new Date();
    var secondsInLastInterval = Math.floor((curTime.getTime()-this.lastStartTime.getTime())/1000);
    seconds += secondsInLastInterval;
  }
  return seconds;
}

MelTaskTimer.prototype.getPassedMinutes = function() {
  return Math.floor(this.getPassedSeconds()/60) % 60;
}

MelTaskTimer.prototype.getPassedHours = function() {
  return Math.floor(this.getPassedSeconds()/3600);
}

MelTaskTimer.prototype.convertNumberToTwoDigitString = function(n) {
  if (n>9) {
    return "" + n;
  } else {
    return "0" + n;
  }
}

MelTaskTimer.prototype.getPassedTimeString = function() {
  return "" + this.convertNumberToTwoDigitString(this.getPassedHours()) + 
        ":" + this.convertNumberToTwoDigitString(this.getPassedMinutes());
}

MelTaskTimer.prototype.getStartTimeString = function() {
  return "" + this.convertNumberToTwoDigitString(this.startTime.getHours()) + 
        ":" + this.convertNumberToTwoDigitString(this.startTime.getMinutes());
}

MelTaskTimer.prototype.getFinishTimeString = function() {
  return "" + this.convertNumberToTwoDigitString(this.finishTime.getHours()) + 
        ":" + this.convertNumberToTwoDigitString(this.finishTime.getMinutes());
}

MelTaskTimer.prototype.getDateString = function() {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth()+1; //January is 0!
  var yyyy = today.getFullYear();

  if (dd<10) {
    dd ='0' + dd;
  } 

  if (mm<10) {
    mm = '0' + mm;
  } 

  return dd + '/' + mm + '/' + yyyy;
}

var melTaskTimer = new MelTaskTimer();

////////////////////////////////////////////////////////////////
// MelExperiments & MelSets
////////////////////////////////////////////////////////////////

function MelExperiment(googleSheetJsonRecord) {
  this.taskFields = ["innertitle", "id", "set", "setnumber", "setid"];
  this.taskAdditionalFields = [];
  for (var i=0; i<this.taskFields.length; i++) {
    var field = this.taskFields[i];
    this[field] = googleSheetJsonRecord["gsx$"+field]["$t"];
  }
}

function MelExperiments(googleSheetJson) {
  this.experiments = [];
  for (var i=0; i<googleSheetJson.feed.entry.length; i++) {
    this.experiments[i] = new MelExperiment(googleSheetJson.feed.entry[i]);
  }
}

MelExperiments.prototype.getExperimentByInnerTitle = function(innerTitle) {
  for (var i=0; i<this.experiments.length; i++) {
    var experiment = this.experiments[i];
    if (experiment.innertitle==innerTitle) {
      return experiment;
    }
  }
  return null;
}

function importMelExperiments(googleSheetJson) {
  melExperiments = new MelExperiments(googleSheetJson);

  //Build melSets based on experiment list
  melSets = {};
  for (var i=0; i<melExperiments.experiments.length; i++) {
    var e = melExperiments.experiments[i];
    melSets[e.set] = {};
    melSets[e.set].number = e.setnumber;
    melSets[e.set].id = e.setid;
  }
}

var melExperiments = null;
var melSets = null;


////////////////////////////////////////////////////////////////
// MelChecklists
////////////////////////////////////////////////////////////////

function MelCheckItem(googleSheetJsonRecord) {
  this.fields = ["taskid", "checkitem", "type"];
  this.additionalFields = [];
  for (var i=0; i<this.fields.length; i++) {
    var field = this.fields[i];
    this[field] = googleSheetJsonRecord["gsx$"+field]["$t"];
  }
}

MelCheckItem.prototype.getString = function(task) {
  var str = this.checkitem;
  if (this.type=="experiment_page") {
    str = "Check <a target='_blank' href='https://www.melscience.com/admin/experiments/update/<experiment_id>/'>experiment page</a> field '<b>" + this.checkitem + "</b>'";
  }
  if (this.type=="set_page") {
    str = "Check <a target='_blank' href='https://www.melscience.com/admin/box/update/<set_id>/'>set page</a> field '<b>" + this.checkitem + "</b>'";
  }
  if (this.type=="google_drive_file") {
    str = "File '<b>" + this.checkitem.replace("MEL Science\\MEL Chemistry\\topics\\", "") + "</b>' is created";
  }
  return str.replace(/<set_innertitle>/g, task.set).replace(/<set_number>/g, task.setnumber).replace(/<set_id>/g, task.setid).replace(/<experiment_innertitle>/g, task.experiment).replace(/<experiment_id>/g, task.experimentid);
}

//Populates HTML elements with class="field_xxx" with content of task property xxx, for all task properties
MelCheckItem.prototype.populateCheckItemData = function(container, task) {
  for (var i=0; i<this.fields.length; i++) {
    var field = this.fields[i];
    $(container).find(".field_"+field).html(this[field]);
  }
  $(container).find(".field_string").html(this.getString(task));
}

function MelCheckLists(googleSheetJson) {
  this.checkitems = [];
  for (var i=0; i<googleSheetJson.feed.entry.length; i++) {
    this.checkitems[i] = new MelCheckItem(googleSheetJson.feed.entry[i]);
  }
}

MelCheckLists.prototype.getCheckItems = function(taskId) {
  var arr = [];
  for (var i=0; i<this.checkitems.length; i++) {
    var checkItem = this.checkitems[i];
    if (checkItem.taskid==taskId) {
      arr.push(checkItem);
    }
  }
  return arr;
}

function importMelChecklists(googleSheetJson) {
  melChecklists = new MelCheckLists(googleSheetJson);
}

var melChecklists = null;

////////////////////////////////////////////////////////////////
// MelRoles
////////////////////////////////////////////////////////////////

function MelRoleList(googleSheetJson) {
  this.globalRoles = {};
  this.setRoles = {};
  for (var i=0; i<googleSheetJson.feed.entry.length; i++) {
    var entry = googleSheetJson.feed.entry[i];
    var set = entry["gsx$"+"set"]["$t"];
    var role = entry["gsx$"+"role"]["$t"];
    var person = entry["gsx$"+"person"]["$t"];
    if (set=="") {
      this.globalRoles[role] = person;
    } else {
      if (!(set in this.setRoles)) {
        this.setRoles[set] = {};
      }
      this.setRoles[set][role] = person;
    }
  }
}

MelRoleList.prototype.getResponsible = function(set, role) {
  if (!(role in this.globalRoles)) {
    console.log("Error. Role '" + role + "' not found.");
  }

  var defaultResponsible = this.globalRoles[role];
  if (set in this.setRoles) {
    if (role in this.setRoles[set]) {
      return this.setRoles[set][role];
    }
  }
  return defaultResponsible;
}

function importMelRoles(googleSheetJson) {
  melRoles = new MelRoleList(googleSheetJson);
}

var melRoles = null;

