$(document).ready(function () {

  // Multimap (array of hashes) to store the JUnit tree of testcases
  var xml;
  var json = [];
  var filteredTotal = 0;
  var netTotal = 'unknown';
  var filters = {
    'showPass': false,
    'showFail': true,
    'showError': true,
    'showSkip': false,
    'match': null
  };

  $('#results').hide();
  $('#tree-row').hide();
  $('.testcase-details').hide();
  $('#progress-row').show();
  $('#result button').prop('disabled', true);
  $('#result input').prop('disabled', true);

  // Render the button state
  renderButtons($('#filterButtons'), filters);

  //Try to obtain the url of the xUnit Result to be loaded
  if (location.search.split('?').length > 1) {

    $('#uploader').hide();
    $('#results').show();

    // Load the xUnit Results and render
    $.ajax({
      url: location.search.split('?')[1]
    }).fail(function (jqXHR, textStatus, errorThrown) {
      $('#jtree').html("An error has occurred: " + textStatus + "<br>" + errorThrown);
      $('#progress-row').hide();
      $('#tree-row').show();
      $('#tree-expandcollapse').hide();
    }).done(processXml);
  } else {
    document.querySelector("#upload-input").onchange = function () {
      var reader = new FileReader();
      reader.onload = function (data) {
        $('#uploader').hide();
        $('#results').show();
        xml = data.target.result;
        processXml(xml);
      };
      reader.readAsBinaryString(document.querySelector("#upload-input").files[0]);
    }
  }

  function search() {

    // Show/Hide content
    $('#progress-row').show();
    $('#tree-row').hide();
    $('#result button').prop('disabled', true);
    $('#result input').prop('disabled', true);

    setTimeout(function () {

      // Update the filter
      var match = $('#tree-search').val();
      if (match && match.length > 0) filters.match = match;
      else filters.match = null;

      setTimeout(function () {

        // Update and rerender tree
        $('#jtree').jstree().destroy();
        filteredTotal = 0;
        renderTree($('#jtree'), applyFilter(json, filters));

        // Show/Hide content    
        $('#tree-row').show();
        $('#progress-row').hide();
        $('#result button').prop('disabled', false);
        $('#result input').prop('disabled', false);
      }, 2);
    }, 2);

  }

  function processXml(data) {
    try {
      xml = $(data);
    } catch (error) {
      $('#jtree').html("An error has occurred...<br>" + error);
      $('#tree-row').show();
      $('#progress-row').hide();
      $('#tree-expandcollapse').hide();
      return;
    }

    var testcases = xml.find('testcase');
    netTotal = testcases.length;

    if (netTotal === 0) {
      $('#jtree').html("No testcases found.");
      $('#tree-row').show();
      $('#progress-row').hide();
      $('#tree-expandcollapse').hide();
      return;
    }

    // Iterate over each testcase and add it to the multimap
    testcases.each(function () {
      // Build up the testcase Object
      var element = buildElement(this);

      // Add the testcase Object to the json multimap
      reduce(json, element.classname, element);
    });

    filteredTotal = 0;
    renderTree($('#jtree'), applyFilter(json, filters));
    renderButtons($('#filterButtons'), filters);

    $('#tree-row').show();
    $('#progress-row').hide();
    $('#result button').prop('disabled', false);
    $('#result input').prop('disabled', false);


    // Bind the Button events
    $('#filterButtons').find('button').click(function () {
      var element = $(this);

      // Show/Hide content
      $('#progress-row').show();
      $('#tree-row').hide();
      $('#result button').prop('disabled', true);
      $('#result input').prop('disabled', true);

      setTimeout(function () {

        // Update the filter
        element.toggleClass('active');
        var id = element.attr('id');
        if (id === "btnPass") filters.showPass = element.hasClass('active');
        else if (id === "btnFailure") filters.showFail = element.hasClass('active');
        else if (id === "btnError") filters.showError = element.hasClass('active');
        else if (id === "btnSkipped") filters.showSkip = element.hasClass('active');

        // Rerender the buttons
        renderButtons($('#filterButtons'), filters);

        setTimeout(function () {

          // Update and rerender tree
          $('#jtree').jstree().destroy();
          filteredTotal = 0;
          renderTree($('#jtree'), applyFilter(json, filters));

          // Show/Hide content    
          $('#tree-row').show();
          $('#progress-row').hide();
          $('#result button').prop('disabled', false);
          $('#result input').prop('disabled', false);
        }, 2);
      }, 2);

    }); // End-Filter

    // Bind the Expand/Collapse events
    $('#linkExpand').click(function (event) {
      $('#jtree').jstree('open_all');
      event.preventDefault();
    });
    $('#linkCollapse').click(function (event) {
      $('#jtree').jstree('close_all');
      event.preventDefault();
    });

    // Bind the search events
    $('#tree-search').keyup(function (event) {
      if (event.keyCode === 13) {
        search();
      }
      event.preventDefault();
    });
    $('#btnSearch').click(function (event) {
      search();
      event.preventDefault();
    }); // End-search

  }


  function applyFilter(multimap, filter) {

    var filtMap = [];
    multimap.forEach(function (element) {
      element = JSON.parse(JSON.stringify(element)); //Clone
      if (element.children) {
        element.children = applyFilter(element.children, filters);
        if (element.children.length > 0) filtMap.push(element);
      } else {
        var match = filters.match;
        var text = element.classname + '.' + element.name;

        var show =
          (!filters.match || text.indexOf(match) > -1) //
        && (
          (filters.showPass && element.status == "passed") //
          || (filters.showFail && element.status == "failure") //
          || (filters.showError && element.status == "error") //
          || (filters.showSkip && element.status == "skipped"));
        if (show) {
          filtMap.push(element);
          filteredTotal++;
        }
      }
    });

    return filtMap;
  }

  /**
   * Modifies a multimap by inserting nodes matching the
   * provided period-delimited path and storing a leaf at the bottom
   *
   * @param multimap An array of hashmaps corresponding to all added paths
   * @param path A classpath delimited by '.' between nodes
   * @param leaf The object to store at the end of the provided path
   *
   * @return nothing. Instead, the multimap is modified by this function
   */
  function reduce(multimap, path, leaf) {

    var key = path.split(".")[0];
    var remainder = path.substring(key.length + 1, path.length);
    var node;

    // Find the node->key in the current map or create a new one
    for (i = 0; i < multimap.length; ++i) {
      var subnode = multimap[i];
      if (subnode.name && subnode.name === key) {
        node = subnode;
        break;
      }
    }
    if (!node) { // If the node did not exist, create anew
      node = {
        "name": key,
        "text": key,
        "type": "node-pass",
        "children": [],
        "status": "passed"
      };

      multimap.push(node);
    }

    // Recurse down to leaves via subtree + substring, or add leaf
    if (key && remainder.length > 0) {
      reduce(node.children, remainder, leaf);
    } else {
      node.children.push(leaf);
    }

    // Update the Status of this node
    if (node.status === "error" || leaf.status === "error") {
      node.status = "error";
      node.type = "node-err";
    } else if (node.status === "failure" || leaf.status === "failure") {
      node.status = "failure";
      node.type = "node-fail";
    } else if (node.status === "skipped" || leaf.status === "skipped") {
      node.status = "skipped";
      node.type = "node-skip";
    } else if (node.status === "passed" || leaf.status === "passed") {
      node.status = "passed";
      node.type = "node-pass";
    }
  }


  function renderTree(element, data) {
    // Render the total
    $('#tree-row .totals').html(filteredTotal + ' of ' + netTotal);

    // Render the tree to the page
    element.jstree({
      "core": {
        "animation": 200, //Animation time (ms)
        "check_callback": false, //Prevent tree CRUD
        "progressive_render": true,
        "themes": {
          "stripes": true, //Alternate-row stripes
          "responsive": false // disaple RWD use of glyphicon
        },
        'data': data
      },
      "plugins": [
          "search", "sort", "state", "types", "wholerow"
        ],
      "search": {
        "case_sensitive": true,
        "close_opened_onclear": true,
        "fuzzy": false,
        "show_only_matches": false,
        "search_leaves_only": false
      },
      "types": {
        "node-pass": {
          "icon": "glyphicon"
        },
        "node-fail": {
          "icon": "glyphicon glyphicon-zoom-in failure"
        },
        "node-err": {
          "icon": "glyphicon glyphicon-fire error"
        },
        "node-skip": {
          "icon": "glyphicon glyphicon-pause skipped"
        },
        "case-pass": {
          "icon": "glyphicon",
          "max_children": 0,
          "max_depth": 0
        },
        "case-fail": {
          "icon": "glyphicon glyphicon-zoom-in failure",
          "max_children": 0,
          "max_depth": 0
        },
        "case-err": {
          "icon": "glyphicon glyphicon-fire error",
          "max_children": 0,
          "max_depth": 0
        },
        "case-skip": {
          "icon": "glyphicon glyphicon-pause skipped",
          "max_children": 0,
          "max_depth": 0
        }
      }
    });

    element.on('select_node.jstree', function (event, data) {
      try {
        var testElement = $('.testcase-details');

        if (data && data.node && data.node.original && data.node.original.classname) {
          var testJson = data.node.original;
          testElement.find('.classname').html(testJson.classname);
          testElement.find('.name').html(testJson.name);
          testElement.find('.status').html(testJson.status);
          testElement.find('.message').val(testJson.stack || testJson.message);

          if (testJson.status == "passed") testElement.find('.status').html($('#btnPass').html());
          else if (testJson.status == "failure") testElement.find('.status').html($('#btnFailure').html());
          else if (testJson.status == "error") testElement.find('.status').html($('#btnError').html());
          else if (testJson.status == "skipped") testElement.find('.status').html($('#btnSkipped').html());

          console.log("Testcase selected:", testJson);
          testElement.slideDown();
        } else testElement.slideUp();
      } catch (ex) {
        console.error('Failed to render node popup: ' + ex);
      }
    })
      .jstree();
  }

  function buildElement(testcase) {
    var element = {
      'status': 'passed',
      'type': 'case-pass'
    };
    for (var i = 0; i < testcase.attributes.length; i++) {
      var attrName = testcase.attributes.item(i).nodeName;
      var attrVal = testcase.attributes.item(i).nodeValue;
      element[attrName] = attrVal;
    }
    var child = $(testcase);
    var failure = child.find('failure');
    var error = child.find('error');
    var skipped = child.find('skipped');
    if (skipped.length > 0) {
      element.status = 'skipped';
      element.type = 'case-skip';
    } else if (failure.length > 0) {
      element.status = 'failure';
      element.type = 'case-fail';
      element.stack = failure[0].textContent;
      element.message = failure[0].getAttribute('message');
    } else if (error.length > 0) {
      element.status = 'error';
      element.type = 'case-err';
      element.message = error[0].getAttribute('message');
      element.stack = error[0].textContent;
    }
    element.text = element.name;
    return element;
  }

  function renderButtons(element, filters) {
    if (filters.showError) element.find('#btnError').addClass("active");
    else element.find('#btnError').removeClass("active");

    if (filters.showFail) element.find('#btnFailure').addClass("active");
    else element.find('#btnFailure').removeClass("active");

    if (filters.showSkip) element.find('#btnSkipped').addClass("active");
    else element.find('#btnSkipped').removeClass("active");

    if (filters.showPass) element.find('#btnPass').addClass("active");
    else element.find('#btnPass').removeClass("active");
  }

});