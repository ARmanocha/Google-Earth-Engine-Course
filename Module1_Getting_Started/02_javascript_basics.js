/*******************************************************************************
 * GOOGLE EARTH ENGINE FOR BEGINNERS — Landslides in the Polish Carpathians
 * Module 1 · Script 02 — The JavaScript you need for Earth Engine
 * -----------------------------------------------------------------------------
 * WHAT YOU WILL LEARN
 *   • Comments, variables and the basic types of data (numbers, text, true/false)
 *   • Lists and dictionaries (objects)
 *   • Functions — reusable recipes
 *   • if / else and loops (on your computer)
 *   • The MOST IMPORTANT idea in GEE: "client" vs "server" objects
 *   • Earth Engine's own types: ee.Number, ee.String, ee.List, ee.Dictionary, ee.Date
 *
 * Run the script, then read the Console from top to bottom alongside the code.
 ******************************************************************************/


// =============================================================================
// PART 1 — Comments
// =============================================================================

// A line starting with two slashes is a single-line comment.

/* Text between slash-star and star-slash is a multi-line comment.
   Use it for longer notes. Earth Engine ignores all of this. */

// Shortcut: select lines and press Ctrl + /  (Cmd + / on Mac) to comment them.


// =============================================================================
// PART 2 — Variables and basic data types
// =============================================================================

// "var" creates a variable. The name goes on the left of =, the value on the right.
// Variable names: no spaces, cannot start with a number, and are CASE-SENSITIVE
// (myTown and mytown are two different variables).

// A STRING is text. It must be inside quotes.
var townName = 'Limanowa';

// A NUMBER is written without quotes. Decimals use a dot (not a comma!).
var latitude = 49.71;

// Another number (whole numbers and decimals are the same type in JavaScript).
var elevationMetres = 400;

// A BOOLEAN is either true or false (no quotes).
var isInCarpathians = true;

// Print each variable. Text before the comma is just a label for the Console.
print('Town name:', townName);
print('Latitude:', latitude);
print('Elevation (m):', elevationMetres);
print('Is it in the Carpathians?', isInCarpathians);

// Arithmetic with numbers: + - * /  and brackets ( ) like in maths.
var elevationKm = elevationMetres / 1000;
print('Elevation in km:', elevationKm);

// The + sign JOINS strings together (called "concatenation").
var sentence = townName + ' is at about ' + elevationMetres + ' m above sea level.';
print(sentence);


// =============================================================================
// PART 3 — Lists (also called "arrays")
// =============================================================================

// A list holds several values in order, inside square brackets [ ].
var bandNames = ['B2', 'B3', 'B4', 'B8'];

// Print the whole list.
print('My list of bands:', bandNames);

// Get one item by its POSITION (called an "index"). Counting starts at 0!
// bandNames[0] is the first item 'B2', bandNames[3] is the fourth item 'B8'.
print('First band:', bandNames[0]);

// .length tells you how many items a list has.
print('Number of bands in the list:', bandNames.length);

// A list of numbers — e.g. coordinates [longitude, latitude].
var limanowaCoords = [20.42, 49.71];
print('Limanowa coordinates:', limanowaCoords);


// =============================================================================
// PART 4 — Dictionaries (JavaScript "objects")
// =============================================================================

// A dictionary stores KEY: VALUE pairs inside curly brackets { }.
// You have already used one for visualisation: {min: 0, max: 3000}.
var townInfo = {
  name: 'Limanowa',            // key "name" has the value 'Limanowa'
  voivodeship: 'Małopolskie',  // key "voivodeship" (the Polish region)
  lon: 20.42,                  // key "lon"
  lat: 49.71                   // key "lat"
};

// Print the whole dictionary.
print('Town information:', townInfo);

// Read one value with a dot and the key name...
print('Voivodeship:', townInfo.voivodeship);

// ...or with square brackets and the key in quotes (both do the same thing).
print('Longitude:', townInfo['lon']);


// =============================================================================
// PART 5 — Functions: reusable recipes
// =============================================================================

// A FUNCTION is a block of code you can run again and again with different inputs.
//   • "function" keyword, then the function's name
//   • inputs (called "parameters") go inside ( )
//   • the code goes inside { }
//   • "return" sends the answer back
// Slope steepness is given either in PERCENT (rise ÷ run × 100, as on road signs)
// or in DEGREES (as in Earth Engine). This function converts percent to degrees.
function slopePercentToDegrees(percent) {
  // Math.atan() gives the angle (in radians) whose tangent is rise ÷ run.
  // Multiplying by 180 / Math.PI converts radians to degrees.
  return Math.atan(percent / 100) * 180 / Math.PI;
}

// "Call" the function by writing its name and giving it an input in ( ).
// A 100 % slope (1 m up for every 1 m along) is 45 degrees.
print('100 % slope in degrees:', slopePercentToDegrees(100));

// Call it again with a different input — that is the point of a function.
print('25 % slope in degrees:', slopePercentToDegrees(25));

// Functions can also be stored in a variable. This does exactly the same thing.
// You will see BOTH styles in Earth Engine scripts.
var squareKmToHectares = function(km2) {
  // 1 km² = 100 hectares.
  return km2 * 100;
};

// Use the second function.
print('5 km² in hectares:', squareKmToHectares(5));


// =============================================================================
// PART 6 — if / else and for-loops (these run on YOUR computer)
// =============================================================================

// An if-statement runs code only when a condition is true.
// Comparison signs: >  <  >=  <=  === (equal)  !== (not equal)
if (elevationMetres > 500) {
  // Runs only if the condition is true.
  print(townName + ' is above 500 m.');
} else {
  // Runs only if the condition is false.
  print(townName + ' is below 500 m.');
}

// A for-loop repeats code. Read it as:
//   start with i = 0;  keep going while i < 3;  add 1 to i after each round (i++).
for (var i = 0; i < 3; i++) {
  // This line runs 3 times, with i = 0, then 1, then 2.
  print('Loop round number', i);
}

// IMPORTANT: if/else and for-loops work on ordinary JavaScript values
// (numbers, strings, lists). They do NOT work on Earth Engine objects
// (ee.Number, ee.Image, ...). For those we use .map() and filters — see Part 8.


// =============================================================================
// PART 7 — CLIENT vs SERVER (the most important idea in Earth Engine)
// =============================================================================

// Everything we have done so far ran in YOUR browser (the "client").
// Anything that starts with ee. is a SERVER object: it is only a *recipe*
// that Google's computers will cook when you print it, map it or export it.

// A client-side number: lives in your browser.
var clientNumber = 5;

// A server-side number: lives on Google's servers.
var serverNumber = ee.Number(5);

// Client maths uses + - * /
print('Client: 5 + 10 =', clientNumber + 10);

// Server maths uses METHODS: .add() .subtract() .multiply() .divide()
print('Server: 5 + 10 =', serverNumber.add(10));

// WRONG (do not do this): mixing them with + gives nonsense, because your browser
// does not know what is inside the server object yet. Try un-commenting it:
// print('Wrong way:', serverNumber + 10);

// Methods can be CHAINED: each one works on the result of the previous one.
// (5 + 10) × 2 − 4 = 26
print('Chained server maths:', serverNumber.add(10).multiply(2).subtract(4));


// =============================================================================
// PART 8 — Earth Engine's basic types
// =============================================================================

// ---- ee.String: server-side text -------------------------------------------
// Create a server-side string.
var eeText = ee.String('Sentinel-2');

// .cat() joins (concatenates) strings on the server.
print('ee.String joined:', eeText.cat(' is a European satellite'));

// ---- ee.List: server-side list ---------------------------------------------
// Create a server-side list.
var eeList = ee.List([10, 20, 30, 40]);

// .get(index) reads one item; counting starts at 0 (so index 2 → 30).
print('Third item of the ee.List:', eeList.get(2));

// .size() is the server version of .length.
print('Size of the ee.List:', eeList.size());

// ee.List.sequence(start, end, step) makes a list of numbers.
// Here: 2018, 2019, ... 2024 — very useful for looping over years.
var years = ee.List.sequence(2018, 2024);
print('List of years:', years);

// .map() runs a function on EVERY item of a list and returns a new list.
// This is how we "loop" on the server. Inside, wrap the item with ee.Number()
// so Earth Engine knows it is a number.
var yearsPlusOne = years.map(function(year) {
  // Add 1 to each year and return it.
  return ee.Number(year).add(1);
});

// Print the new list (2019 ... 2025).
print('Each year + 1:', yearsPlusOne);

// ---- ee.Dictionary: server-side dictionary ---------------------------------
// Create a server-side dictionary from a normal JavaScript object.
var eeDict = ee.Dictionary({satellite: 'Landsat 9', resolution_m: 30});

// .get(key) reads a value from it.
print('Resolution from ee.Dictionary:', eeDict.get('resolution_m'));

// .keys() returns all keys as an ee.List.
print('Dictionary keys:', eeDict.keys());

// ---- ee.Date: server-side dates --------------------------------------------
// Create a date from text in the format 'YYYY-MM-DD'.
// 1 June 2010 is the day the Kłodne landslide near Limanowa started to move.
var date = ee.Date('2010-06-01');

// Print the date (Earth Engine stores it as milliseconds since 1 Jan 1970).
print('A date:', date);

// .advance(amount, unit) moves the date forward. Units: 'day','week','month','year'.
// A negative amount moves it backwards: 30 days BEFORE the landslide.
print('30 days earlier:', date.advance(-30, 'day'));

// .get('year') extracts a part of the date ('year', 'month', 'day').
print('Year of the date:', date.get('year'));

// .format() turns the date into readable text.
// YYYY = year, MM = month number, dd = day, MMM = short month name.
print('Formatted date:', date.format('dd MMM YYYY'));

// .getRelative('day', 'year') gives the "day of year" (counting from 0).
print('Day of year (0 = 1 Jan):', date.getRelative('day', 'year'));

// ee.Date.fromYMD(year, month, day) builds a date from numbers.
print('Date from numbers:', ee.Date.fromYMD(2024, 1, 1));


// =============================================================================
// PART 9 — Bringing a server value back to the client (only when needed)
// =============================================================================

// Sometimes you need the actual value in your browser (for example, to put it
// in a label). .evaluate() asks the server for the answer and then runs your
// function with it, WITHOUT freezing the browser while it waits.
serverNumber.multiply(100).evaluate(function(result) {
  // "result" is now a plain JavaScript number in your browser.
  print('Value fetched from the server with evaluate():', result);
});

// You may also see .getInfo() in older scripts. It does the same thing but
// FREEZES the browser until the answer arrives. Avoid it in loops and large jobs.


// =============================================================================
// PART 10 — Common beginner mistakes (read these!)
// =============================================================================

// 1. Wrong capitalisation:  ee.image(...)   ✗     ee.Image(...)   ✓
// 2. Missing comma between items:  {min: 0 max: 1}  ✗   {min: 0, max: 1}  ✓
// 3. Missing quotes around text:   ee.Image(USGS/SRTMGL1_003) ✗
// 4. Latitude first:  ee.Geometry.Point([49.71, 20.42])  ✗  (it's [lon, lat])
//    (In Poland latitude ≈ 49–55 and longitude ≈ 14–24, so swapped numbers put
//     your point in Saudi Arabia or the Arabian Sea!)
// 5. Decimal comma:  20,42  ✗   20.42  ✓   (JavaScript always uses a dot)
// 6. Using + on server objects:   ee.Number(5) + 1  ✗   ee.Number(5).add(1) ✓
// 7. Unclosed brackets ( [ {  — the editor shows a red mark; count them!
// 8. Forgetting "var" the first time you create a variable.


/*******************************************************************************
 * TRY IT YOURSELF
 *   1. Make a variable with your own town's name and elevation, and print a
 *      sentence like "Kraków is at about 219 m above sea level."
 *   2. Write a function degreesToPercent(deg) that does the opposite of
 *      slopePercentToDegrees. (Hint: Math.tan(deg * Math.PI / 180) * 100.)
 *      What is a 30° slope in percent?
 *   3. Make an ee.List of the months 1 to 12 with ee.List.sequence(1, 12) and
 *      use .map() to multiply each month by 10.
 *   4. Create ee.Date('2010-05-01') and print the date 45 days later.
 ******************************************************************************/
