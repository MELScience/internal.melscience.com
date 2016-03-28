function MelPublication(publicationList, googleSheetJsonRecord) {
  this.publicationList = publicationList;
  this.publicationFields = ["publication", "website", "lang", "priority", "category", "twitter", "followers", "facebook", "likes"];
//  this.taskAdditionalFields = ["blockedby", "index", "shortstring", "checkitemsstring", "experimentid", "setnumber", "setid", "responsiblerole"];
  for (var i=0; i<this.publicationFields.length; i++) {
    var field = this.publicationFields[i];
    this[field] = googleSheetJsonRecord["gsx$"+field]["$t"];
  }
}

MelPublication.prototype.generateDataSet = function() {
  return [this.publication, this.website, this.lang, this.priority, this.category, this.twitter, this.followers, this.facebook, this.likes];
}

////////////////////////////////////////////////////////////////
// MelPublicationList - list of all publications
////////////////////////////////////////////////////////////////

function MelPublicationList(googleSheetJson) {
  this.publications = [];
  for (var i=0; i<googleSheetJson.feed.entry.length; i++) {
    this.publications[i] = new MelPublication(this.publications, googleSheetJson.feed.entry[i]);
  }
}

MelPublicationList.prototype.getPublicationByName = function(name) {
  for (var i=0; i<this.publications.length; i++) {
    var publication = this.publications[i];                                                                      
    if (publication.publication==name) return publication;
  }
  return null;
}

MelPublicationList.prototype.generateDataSet = function() {
  var dataSet = [];
  for (var i=0; i<this.publications.length; i++) {
    var publication = this.publications[i];                                                                      
    dataSet.push(publication.generateDataSet());
  }
  return dataSet;
}

MelPublicationList.prototype.getFieldValuesArray = function(fieldName) {
  var hash = {};
  for (var i=0; i<this.publications.length; i++) {
    var publication = this.publications[i];                                                                      
    var value = publication[fieldName];
    hash[value] = 1;
  }
  return Object.keys(hash);
}

function importMelPublications(googleSheetJson) {
  melPublications = new MelPublicationList(googleSheetJson);
}

var melPublications = null;

////////////////////////////////////////////////////////////////
// MelJournalist
////////////////////////////////////////////////////////////////

function MelJournalist(journalistList, googleSheetJsonRecord) {
  this.journalistList = journalistList;
  this.journalistFields = ["publication", "link", "name", "position", "country", "city", "lang", "status", "description", "profile", "email", "twitter", "followers", "facebook", "others", "linkedin", "instagram"];
  for (var i=0; i<this.journalistFields.length; i++) {
    var field = this.journalistFields[i];
    this[field] = googleSheetJsonRecord["gsx$"+field]["$t"];
  }
  this.publicationLink = melPublications.getPublicationByName(this.publication);
}

MelJournalist.prototype.generateDataSet = function(fields) {
  var arr = [];
  for (var i=0; i<fields.length; i++) {
    var field = fields[i];
    arr.push(this[field]);
  }
  return arr;
}

////////////////////////////////////////////////////////////////
// MelJournalistList - list of journalists
////////////////////////////////////////////////////////////////

function MelJournalistList(googleSheetJson) {
  this.journalists = [];
  for (var i=0; i<googleSheetJson.feed.entry.length; i++) {
    this.journalists[i] = new MelJournalist(this.journalists, googleSheetJson.feed.entry[i]);
  }
}

MelJournalistList.prototype.generateDataSet = function(fields) {
  var dataSet = [];
  for (var i=0; i<this.journalists.length; i++) {
    var journalist = this.journalists[i];
    dataSet.push(journalist.generateDataSet(fields));
  }
  return dataSet;
}

MelJournalistList.prototype.getFieldValuesArray = function(fieldName) {
  var hash = {};
  for (var i=0; i<this.journalists.length; i++) {
    var journalist = this.journalists[i];                                                                      
    var value = journalist[fieldName];
    hash[value] = 1;
  }
  return Object.keys(hash);
}

function importMelJournalists(googleSheetJson) {
  melJournalists = new MelJournalistList(googleSheetJson);
}

var melJournalists = null;