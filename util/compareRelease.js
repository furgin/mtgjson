"use strict";
/*global setImmediate: true*/

var base = require("xbase"),
	C = require("C"),
	request = require("request"),
	fs = require("fs"),
	url = require("url"),
	shared = require("shared"),
	color = require("cli-color"),
	fileUtil = require("xutil").file,
	diffUtil = require("xutil").diff,
	path = require("path"),
	tiptoe = require("tiptoe");

var setsToDo = shared.getSetsToDo();
var updatedSetFiles = [];

tiptoe(
	function processSets()
	{
		setsToDo.serialForEach(function(code, subcb)
		{
			processSet(code, subcb);
		}, this);
	},
	function processSetsX()
	{
		setsToDo.serialForEach(function(code, subcb)
		{
			processSet(code + "-x", subcb);
		}, this);
	},
	function finish(err)
	{
		base.info(JSON.stringify(updatedSetFiles.uniqueBySort().sort()));

		if(err)
		{
			base.error(err);
			process.exit(1);
		}

		process.exit(0);
	}
);

function processSet(code, cb)
{
	base.info("%s", code);

	tiptoe(
		function getJSON()
		{
			request("http://mtgjson.com/json/" + code + ".json", this.parallel());
			fs.readFile(path.join(__dirname, "..", "web", "json", code + ".json"), {encoding : "utf8"}, this.parallel());
		},
		function compare(oldJSONArgs, newJSON)
		{
			var result = compareSets(JSON.parse(oldJSONArgs[1]), JSON.parse(newJSON), code);
			if(result)
				console.log(result);

			this();
		},
		function finish(err)
		{
			setImmediate(function() { cb(err); });
		}
	);
}

function compareSets(oldSet, newSet, filename)
{
	var result = "";
	var oldCardsMap = oldSet.cards.mutate(function(card, result) { result[(card.name + " (" + card.multiverseid + ")")] = card; return result; }, {});
	var newCardsMap = newSet.cards.mutate(function(card, result) { result[(card.name + " (" + card.multiverseid + ")")] = card; return result; }, {});

	delete oldSet.cards;
	delete newSet.cards;

	var setChanged = diffUtil.diff(oldSet, newSet);
	if(setChanged)
	{
		updatedSetFiles.push(filename);
		result += "SET CHANGED : ";
		result += setChanged;
	}

	var cardsChanged = diffUtil.diff(Object.keys(oldCardsMap), Object.keys(newCardsMap));
	if(cardsChanged)
	{
		updatedSetFiles.push(filename);
		result += "Cards Changed : ";
		result += cardsChanged;
	}

	Object.forEach(oldCardsMap, function(key, oldCard)
	{
		if(!newCardsMap.hasOwnProperty(key))
			return;

		var newCard = newCardsMap[key];

		var subResult = diffUtil.diff(oldCard, newCard);
		if(subResult)
		{
			updatedSetFiles.push(filename);
			result += color.magenta(JSON.stringify(key)) + " : \n";
			result += subResult;
		}
	});

	return result;
}
