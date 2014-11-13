define([
    'backbone',
    'underscore',
    'js/mixins/add_stable_index_to_collection',
],
function(
  Backbone,
  _,
  WidgetPaginationMixin
  ) {

  var ItemModel = Backbone.Model.extend({
    defaults: function () {
      return {
        abstract: undefined,
        title: undefined,
        authorAff: undefined,
        pub: undefined,
        pubdate: undefined,
        keywords: undefined,
        bibcode: undefined,
        pub_raw: undefined,
        doi: undefined,
        details: undefined,
        links_data: undefined,
        resultsIndex: undefined,
        visible: false
      }
    },
    idAttribute: "resultsIndex"

  });


  var ListOfThingsCollection = Backbone.Collection.extend({

    initialize: function (models, options) {
      this.numVisible = 0;
      this.currentStartIndex = 0;
      this.currentEndIndex = 0;
      this.lastIndex = -1;

      if (options && options.paginationModel) {
        this.paginationModel = options.paginationModel;
        this.listenTo(this.paginationModel, "change:page", this._onPaginationChange);
        this.listenTo(this.paginationModel, "change:perPage", this._onPaginationChange);
      }
      this.on("collection:augmented", this.onCollectionAugmented);
    },


    model: ItemModel,

    numFound: undefined,

    comparator: "resultsIndex",

    _updateStartAndEndIndex: function () {
      var pageNum = this.paginationModel.get("page");
      var perPage = this.paginationModel.get("perPage");
      var numFound = this.paginationModel.get("numFound")
      //used as a metric to see if we need to fetch new data or if data at these indexes
      //already exist
      this.currentStartIndex = this.getStartVal(pageNum, perPage);
      this.currentEndIndex = this.getEndVal(pageNum, perPage, numFound);

    },

    _onPaginationChange: function () {
      this._updateStartAndEndIndex();
      //propagate the signal to the controller
      this.trigger("pagination:change");
    },

    onCollectionAugmented: function () {
      if (this.paginationModel) {
        this._updateStartAndEndIndex();
      }
    },

    getStartIndex: function() {
      return this.currentStartIndex;
    },
    getEndIndex: function() {
      return this.paginationModel.get("perPage");
    },

    _incrementLastIndex: function() {
      this.lastIndex += 1;
      return this.lastIndex;
    },

    _prepareModel: function(attrs, options) {
      if (attrs.resultsIndex === undefined) {
        attrs.resultsIndex = this._incrementLastIndex();
      }

      return Backbone.Collection.prototype._prepareModel.call(this, attrs, options);
    },

    updateIndexes: function(start, end) {
      var start = _.isNumber(start) ? start : this.currentStartIndex;
      var end = _.isNumber(end) ?  end : this.currentEndIndex + 1;
      var visible = 0;
      var currStart = null; var currEnd = 0;
      var gaps = [];

      var lastIdx = null; var rIdx;

      this.each(function(model) {
        rIdx = model.attributes.resultsIndex;

        if (model.attributes.emptyPlaceholder) {
          // gaps.push(rIdx); // ignore them altogether
          return; // skip this record
        }

        if (lastIdx !== null && rIdx != lastIdx+1) {
          _.each(_.range(lastIdx+1, rIdx), function(c) {
            gaps.push(c);
          });
        }
        lastIdx = rIdx;
        if (rIdx >= start && rIdx < end) {
          model.set('visible', true);

          if (currStart === null) currStart = rIdx;

          visible += 1;
          currEnd = rIdx;
        }
        else {
          model.set('visible', false);
        }
      });
      if (gaps.length) {
        // we have discoverd all gaps, but we want to report only those that span the start..end range
        for (var i=0; i<gaps.length; i++) {
          if (gaps[i] > end) {
            gaps = gaps.slice(0, i);
            break;
          }
        }

        for (var i=gaps.length; i>0; i--) {
          if (gaps[i] < start) {
            gaps = gaps.slice(i, gaps.length);
            break;
          }
        }

        // to prevent infinite recursion, we'll fill gaps with empty recs
        var self = this;
        _.each(gaps, function(r) {
          self.add({resultsIndex: r, emptyPlaceholder: true});
        });
        this.trigger('show:missing', this._compressGaps(gaps));
      }
      this.numVisible = visible;
      this.currentStartIndex = currStart || 0;
      this.currentEndIndex = currEnd;
      return visible;
    },

    _compressGaps: function(gaps) {
      var leftBound = gaps[0];
      var rightBound = leftBound;
      var s = gaps.length;
      var toSend = [];
      for (var i=0; i<s; i++) {
        var j = i+1;
        while(j < s && gaps[j] == leftBound + (j-i)) {
          rightBound = gaps[j];
          j += 1;
        }
        toSend.push({start: leftBound, end: rightBound});
        i = j-1;
        if (j < s)
          leftBound = rightBound = gaps[j];
      }
      return toSend;
    },

    showRange: function(start, end) {
      if (start < 0) throw new Error("Start cannot be negative");
      if (end < start) throw new Error("End cannot be smaller than start");
      return this.updateIndexes(start, end+1);
    },
    getNumVisible: function() {
      return this.numVisible;
    },

    showMore: function(howMany) {
      if (howMany === null) { // set all of them visible
        return this.updateIndexes(0, this.model.length);
      }
      else {
        var visible = this.getNumVisible();
        return this.updateIndexes(this.currentStartIndex, this.currentEndIndex + howMany) - visible;
      }
    }
  });
  _.extend(ListOfThingsCollection.prototype, WidgetPaginationMixin);
  return ListOfThingsCollection;
});