/**
 * Widget to display list of result hits - it allows to paginate through them
 * and display details
 *
 */

define([
    'underscore',
    'js/widgets/list_of_things/widget',
    'js/widgets/base/base_widget',
    'js/widgets/sort/widget'
    ],

  function (_,
    ListOfThingsWidget,
    BaseWidget,
    SortWidget) {

    var ResultsWidget = ListOfThingsWidget.extend({


      initialize : function(options){

        ListOfThingsWidget.prototype.initialize.apply(this, arguments);

        //now adjusting the List Model

        this.view.model.set("mainResults", true);

        this.listenTo(this.visibleCollection, "reset", this.notifyModelIfHighlights)

      },

      activate: function (beehive) {

        _.bindAll(this, "dispatchInitialRequest", "processResponse");

        this.pubsub = beehive.Services.get('PubSub');

        //custom dispatchRequest function goes here
        this.pubsub.subscribe(this.pubsub.INVITING_REQUEST, this.dispatchInitialRequest);

        //custom handleResponse function goes here
        this.pubsub.subscribe(this.pubsub.DELIVERING_RESPONSE, this.processResponse);
      },


      dispatchInitialRequest  : function(){

        this.resetWidget();

        BaseWidget.prototype.dispatchRequest.apply(this, arguments)
      },

      defaultQueryArguments: function(){
        return {
          hl     : "true",
          "hl.fl": "title,abstract,body",
          fl     : 'title,abstract,bibcode,author,keyword,id,citation_count,pub,aff,email,volume,year'
        }
      },

      checkIfHighlightsExist: function(){

        //check for highlights in the visible collection;

        var highlights = _.map(this.visibleCollection.toJSON(), function(m){

          var d = m.details;
          //returns an object like {details : object}
         if (d){
           return d.highlights;
         }

        });

        var agg = _.flatten(_.map(
          _.values(highlights), function(d){return _.values(d)}
        ));
        //check to make sure that highlights exist
        //and they are not all empty strings
        if (agg.length && agg.join("") !== ""){
          return true
        }

      },

      notifyModelIfHighlights : function(highlights){

        if (this.checkIfHighlightsExist(highlights)){
          this.view.model.set("showDetailsButton", true)
        }
        else {
          this.view.model.set("showDetailsButton", false)

        }

      },


      processResponse: function (apiResponse) {

        this.setCurrentQuery(apiResponse.getApiQuery());

        var toSet = {"numFound":  apiResponse.get("response.numFound"),
          "currentQuery":this.getCurrentQuery()};

        //checking to see if we need to reset start or rows values
        var r =  this.getCurrentQuery().get("rows");
        var s = this.getCurrentQuery().get("start");

        if (r){

          r = $.isArray(r) ? r[0] : r;
          toSet.perPage = r;

        }

        if (s) {

          var perPage =  toSet.perPage || this.paginationModel.get("perPage");

          s = $.isArray(s) ? s[0] : s;

          //getPageVal comes from the pagination mixin
          toSet.page= this.getPageVal(s, perPage);

        }

        var docs = apiResponse.get("response.docs")

        var highlights = apiResponse.get("highlighting");

        //any preprocessing before adding the resultsIndex is done here
        docs = _.map(docs, function (d) {
          d.identifier = d.bibcode;
          var h = {};

          if (_.keys(highlights).length) {

            h = (function () {

              var hl = highlights[d.id];
              var finalList = [];
              //adding abstract,title, etc highlights to one big list
              _.each(_.pairs(hl), function (pair) {
                finalList = finalList.concat(pair[1]);
              });
              finalList = finalList;

              return {
                "highlights": finalList
              }
            }());
          }

          if (h.highlights && h.highlights.length > 0)
            d['details'] = h;

          return d;

        })

        docs = this.parseLinksData(docs);

        docs = this.addPaginationToDocs(docs, apiResponse);

        if (docs.length) {

          //reset the pagination model with toSet values
          //has to happen right before collection changes
          this.paginationModel.set(toSet, {silent : true});

          //just using add because the collection was emptied
          //when a new request was made
          this.collection.add(docs);

          /*
           * we need a special event that fires only once in event
           * of a reset OR an add
           * */
          this.collection.trigger("collection:augmented");

        }

        //resolving the promises generated by "loadBibcodeData"
        if (this.deferredObject){

          this.deferredObject.resolve(this.paginationModel.get("numFound"))
        }

      }


  });

    return ResultsWidget;

  });
