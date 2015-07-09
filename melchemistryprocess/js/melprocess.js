function MelTask(taskList, googleSheetJsonRecord) {
  this.taskList = taskList;
  this.taskFields = ["set", "id", "dependency", "type", "experiment", "name", "description", "results", "responsible", "control", "status", "starttime", "endtime", "totaltime"];
  this.taskAdditionalFields = ["blockedby", "index", "shortstring"];
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
  for (var i=0; i<this.tasks.length; i++) {
    var task = this.tasks[i];
    this.processTaskDependency(task);
    task.index = i+2;
    task.shortstring = task.getShortString();
    task.results = task["results"].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  this.setOptions = [];
  this.responsibleOptions = []
  if (location.hash!="") {
    var arr = location.hash.substring(1).split("-");
    this.set = arr[0];
    this.responsible = arr[1];
  }
}

MelFilter.prototype.updateUrlAddress = function() {
  location.hash = [this.set, this.responsible].join("-");
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

function MelPeople() {
  this.people = [
    {name: "Vassili Philippov", email: "vassili@melscience.com", id: "Vasja"},
    {name: "Sergey Safonov", email: "sergey@melscience.com", id: "Sergey"},
    {name: "Konstantin Gurianov", email: "konstantin@melscience.com", id: "Kostya"},
    {name: "Denis Sapegin", email: "dasapegin@gmail.com", id: "Denis"},
    {name: "Andrey Lyashin", email: "andrey.lyashin@scicon.ru", id: "Andrei"},
    {name: "Kate Gotina", email: "gotinakatia92@gmail.com", id: "EN Translator"},
    {name: "Kate Erofeeva", email: "ekaterina.aleks.erofeeva@gmail.com", id: "RU Editor"},
    {name: "Galina Konstantinova", email: "galina@melscience.com", id: "Galya"},
    {name: "Dmitry Groshev", email: "si14@melscience.com", id: "Dmitry"},
    {name: "Vassili Philippov", email: "vassili@melscience.com", id: "US cert lab"},
    {name: "Sergey Safonov", email: "sergey@melscience.com", id: "Science writer"},
    {name: "Vassili Philippov", email: "vassili@melscience.com", id: "Video producer"},
    {name: "Sergey Safonov", email: "sergey@melscience.com", id: "Video translator"},
    {name: "Artem Messorosh", email: "homess@melscience.com", id: "Artem"}
 ];
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

MelPeople.prototype.sendEmail = function(personId, task) {
  var person = this.find(personId);
  if (person==null) {
    alert("Error sending email. Person '" + personId + "' is not found");
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
                "<br><br><a href='https://docs.google.com/spreadsheets/d/1WqwknAu_mwQfkDtP4UcGZAix2zBwqUmp3A8XX5xUto8/edit#gid=448918918'>Google Sheet</a>"
      }
    }
   }).done(function(response) {
     console.log(response); // if you're into that sorta thing
 });
}


var melPeople = new MelPeople();
