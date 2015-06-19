/**
 * Browser for the Nominal Response Library at the IRIS DMC
 * Philip Crotwell
 * 2014
 */

/**
 * AMD style define, see https://github.com/amdjs/amdjs-api/wiki/AMD
 */

requirejs.config({
    // By default load any module IDs from javascript subdir
    baseUrl : 'javascript',
});

// Start the main app logic.
require([ 'https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.5/d3.min.js' ], function(d3) {

    var nrl2html = {
        version : "0.0.1"

    };

    nrl2html.questionToJson = function(url, callback) {
        console.log("try: " + url);
        d3.text(url, "text/plain", function(error, data) {
            if (error) {
                console.log("Oops, error: "+url);
                console.log(error);
            } else {
                var initial = {
                    root : {
                        name : "NRL",
                        path : url,
                        question : null,
                        detail : null,
                        resp : null,
                        showChildren : false,
                        answers : []
                    },
                    currAnswer : {}
                };

                var parentPath = "";
                if (url.indexOf('/')) {
                    parentPath = url.substring(0, url.lastIndexOf('/')+1);
                }
                lines = data.split("\n");
                lines.reduce(function(accum, curr, i, array) {
                    var sline;
                    var es;
                    curr = curr.trim();
                    if (curr.indexOf("[") == 0) {
                        if (curr.indexOf("[Main]") == 0) {
                        } else if (curr.indexOf("[") == 0) {
                            // answer
                            accum.currAnswer = {
                                value : curr.substring(1, curr.length - 1),
                                loaded : false,
                                showChildren : false
                            };
                            accum.currAnswer.name = accum.currAnswer.value;
                            accum.root.answers.push(accum.currAnswer);
                        }
                    } else if (curr.indexOf("path") == 0) {
                        accum.currAnswer.path = parentPath
                                + dequote(pullParam(curr));
                      //  accum.currAnswer.id = accum.currAnswer.path;
                    } else if (curr.indexOf("resp") == 0) {
                        accum.currAnswer.resp = parentPath
                                + dequote(pullParam(curr));
                    } else if (curr.indexOf("description") == 0) {
                        accum.currAnswer.description = dequote(pullParam(curr));
                        accum.currAnswer.name = accum.currAnswer.name+"  "+accum.currAnswer.description;
                    } else if (curr.indexOf("question") == 0) {
                        accum.root.question = dequote(pullParam(curr));
                    } else if (curr.indexOf("detail") == 0) {
                        accum.root.detail = parentPath
                                + dequote(pullParam(curr));
                    } else if (curr.length == 0) {
                        // nothing
                    } else {
                        console.log("Don't understand: " + curr);
                    }
                    return accum;
                }, initial);
                //console.log("Done with reduce");
                //console.log(JSON.stringify(initial.root, undefined, 2));
                
                if(callback) {
                    callback(initial.root);
                }
            }
        });
    }

    nrl2html.treeGraph = function(json) {
        var m = [ 20, 120, 20, 120 ], w = 1280 - m[1] - m[3], h = 600 - m[0]
                - m[2], i = 0, root;

        var maxDepth = 2;
        var clickDepth = 1;
        
        var tree = d3.layout.tree().size([ h, w ]);
        tree.children(function(d) {
            if(typeof d === "string") {return null;}
            if ( ! d.showChildren) {return null;}
            if(d.answers && d.answers.length > 0) {
                // load next level
                d.answers.forEach(function(ans, index, array) {
                    if (ans.path && ! ans.loaded) {
                        nrl2html.questionToJson(ans.path, function(curAns) {
                            if(curAns.question) {
                                ans.question = curAns.question;
                            }
                            if(curAns.answers) {
                                ans.answers = curAns.answers;
                            }
                            if(curAns.description) {
                                ans.description = curAns.description;
                            }
                            if(curAns.detail) {
                                ans.detail = curAns.detail;
                            }
                            if(curAns.resp) {
                                ans.resp = curAns.resp;
                            }
                            ans.loaded = true;
                            d3.select("#"+makePathId(ans)).select("circle").select("title").text(ans.question);  
                        });
                    }
                });
                return d.answers;
            }
            return null;
        });
        
        var diagonal = d3.svg.diagonal().projection(function(d) {
            return [ d.y, d.x ];
        });

        var vis = d3.select("#nrltree").append("svg:svg").attr("width",
                w + m[1] + m[3]).attr("height", h + m[0] + m[2])
                .append("svg:g").attr("transform",
                        "translate(" + m[3] + "," + m[0] + ")");

        root = json;
        root.x0 = h / 2;
        root.y0 = 0;

        function toggleAll(d) {
            if (d.answers) {
                d.answers.forEach(toggleAll);
                toggle(d);
            }
        }

        // Initialize the display to show a few nodes.
        //root.answers.forEach(toggle);
        toggle(root);

        update(root);
        

        function update(source) {
            var duration = d3.event && d3.event.altKey ? 5000 : 500;

            // Compute the new tree layout.
            var nodes = tree.nodes(root).reverse();

            // Normalize for fixed-depth.
            // This sets the horizontal position (why as y???) based on depth
            // use atan so that things near the most recent click are spread out
            // and things far away from the click are squished together
            nodes.forEach(function(d) {
                var scale = (0.5 + Math.atan(6*(d.depth-clickDepth)/maxDepth)/Math.PI);
                d.y = scale * w;
                console.log("calc from depth "+d.y+" "+clickDepth+" "+maxDepth+ " "+scale);
                if (d != source && ! d.answers) {
                    d.showChildren = false;
                }
            });

            // Update the nodes
            var node = vis.selectAll("g.node").data(nodes, function(d) {
                return d.id || (d.id = ++i);
            });

            // Enter any new nodes at the parent's previous position.
            var nodeEnter = node.enter().append("svg:g").attr("class", "node").attr("id", makePathId)
                    .attr(
                            "transform",
                            function(d) {
                                return "translate(" + source.y0 + ","
                                        + source.x0 + ")";
                            }).on("click", function(d) {
                                d3.select("#nrlResp")
                                .selectAll("div").remove();
                                d3.select("#nrlDetail")
                                .selectAll("div").remove();
                                d3.selectAll(".talkBubble").remove();
                                toggle(d);
                                update(d);
                                
                                // cookie crumb table below plot
                                d3.select("#nrlquestiontable").selectAll("table").remove();
                                var tableOut = d3.select("#nrlquestiontable")
                                var table = tableOut.append("table");
                                table.classed("pathTable", true);
                                var parentText = function(x) {
                                    if (x) {
                                        parentText(x.parent);
                                        var tr = table.append("tr");
                                        if (x.parent) {
                                            tr.append("td").text(x.parent.question);
                                        } else {
                                            tr.append("td").text("");
                                        }
                                        tr.append("td").text(x.name);
                                    }
                                }
                                parentText(d);
                                
                                if (d.showChildren && d.question) {
                                    var circleG = d3.select("#"+makePathId(d));
                                    
                                    var innerG = circleG.append("g").classed("talkBubble", true);
                                    var text = innerG.append("text")
                                    .attr("x", 0)
                                    .attr("y", 25)
                                    .text(d.question);
                                    console.log("before bbox");
                                    var bbox = text.node().getBBox();
                                    var textPadding = 2;
                                    
                                    var rect = innerG.insert("rect", "text");
                                    console.log("after rect");
                                    rect.attr("x", bbox.x - textPadding)
                                    .attr("y", bbox.y - textPadding)
                                    .attr("width", bbox.width + (textPadding*2))
                                    .attr("height", bbox.height + (textPadding*2))
                                    .style("fill", "white");
                                    
                                }
                                if (d.detail) {
                                    d3.html(d.detail, function(error, data) {
                                        if (error) {
                                            console.log("Oops, error: "+d.resp);
                                            console.log(error);
                                        } else {
                                            var detailOut = d3.select("#nrlDetail")
                                            .selectAll("div")
                                            .data([data]);
                                            var detailEnter = detailOut
                                            .enter()
                                            .append("div");
                                            detailEnter.append("h3").text("Detail:");
                                            detailEnter.node().appendChild(data);
                                        }
                                    });
                                }
                                if (d.resp) {
                                    d3.text(d.resp, "text/plain", function(error, data) {
                                        if (error) {
                                            console.log("Oops, error: "+d.resp);
                                            console.log(error);
                                        } else {
                                            var respOut = d3.select("#nrlResp")
                                            .selectAll("div")
                                            .data([data]);
                                            var respEnter = respOut
                                            .enter()
                                            .append("div");
                                            var p = respEnter.append("p");
                                            p.text("Response: ");
                                            p.text(d.description);
                                            p.append("a").attr("href", d.resp)
                                            .text(" Download");
                                            respEnter
                                            .append("textarea")
                                            .attr("readonly", "true")
                                            .attr("cols", 120)
                                            .attr("rows", 25)
                                            .text(data);
                                            respOut.exit().remove();
                                        }
                                    });
                                }
                            });

            nodeEnter.append("svg:circle").attr("r", 1e-6).style("fill",
                    function(d) {
                        return d.showChildren ? "lightsteelblue" : "#fff";
                    })
                    .append("svg:title")
                    .text(function(d) { 
                        if(d.question) { return d.question; }
                        if (d.resp) { return d.resp; }
                        return null; 
                        });

            nodeEnter.append("svg:text").attr("x", function(d) {
                return (d.showChildren && d.answers) ? -10 : 10;
            }).attr("dy", ".35em").attr("text-anchor", function(d) {
                return (d.showChildren && d.answers) ? "end" : "start";
            }).text(function(d) {
                return d.name;
            }).style("fill-opacity", 1e-6)
            .style("font-weight", function(d) {
                return d.showChildren ? "bold" : "normal";
            });
            
            
            
            // Transition nodes to their new position.
            var nodeUpdate = node.transition().duration(duration).attr(
                    "transform", function(d) {
                        return "translate(" + d.y + "," + d.x + ")";
                    });

            nodeUpdate.select("circle").attr("r", 4.5).style("fill",
                    function(d) {
                        return d.showChildren ? "lightsteelblue" : "#fff";
                    });

            nodeUpdate.select("text").attr("x", function(d) {
                return (d.showChildren && d.answers) ? -10 : 10;
            }).attr("dy", ".35em").attr("text-anchor", function(d) {
                return (d.showChildren && d.answers) ? "end" : "start";
            }).style("fill-opacity", 1)
            .style("font-weight", function(d) {
                return d.showChildren ? "bold" : "normal";
            });

            // Transition exiting nodes to the parent's new position.
            var nodeExit = node.exit().transition().duration(duration).attr(
                    "transform", function(d) {
                        return "translate(" + source.y + "," + source.x + ")";
                    }).remove();

            nodeExit.select("circle").attr("r", 1e-6);

            nodeExit.select("text").attr("x", function(d) {
                return (d.showChildren && d.answers) ? -10 : 10;
            }).attr("dy", ".35em").attr("text-anchor", function(d) {
                return (d.showChildren && d.answers) ? "end" : "start";
            }).style("fill-opacity", 1e-6)
            .style("font-weight",  "normal");

            // Update the links
            var link = vis.selectAll("path.link").data(tree.links(nodes),
                    function(d) {
                        return d.target.id;
                    });

            // Enter any new links at the parent's previous position.
            link.enter().insert("svg:path", "g").attr("class", "link").attr(
                    "d", function(d) {
                        var o = {
                            x : source.x0,
                            y : source.y0
                        };
                        return diagonal({
                            source : o,
                            target : o
                        });
                    }).transition().duration(duration).attr("d", diagonal);

            // Transition links to their new position.
            link.transition().duration(duration).attr("d", diagonal);

            // Transition exiting nodes to the parent's new position.
            link.exit().transition().duration(duration).attr("d", function(d) {
                var o = {
                    x : source.x,
                    y : source.y
                };
                return diagonal({
                    source : o,
                    target : o
                });
            }).remove();

            // Stash the old positions for transition.
            nodes.forEach(function(d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        // Toggle children.
        function toggle(d) {
            d.showChildren = ! d.showChildren;
            if (d.depth) {
                if (d.answers) {
                    // only update clickDepth if not a leaf
                    clickDepth = d.depth;
                }
                if (d.showChildren && d.depth >= maxDepth) {
                    maxDepth = d.depth+1;
                } else {console.log(d.showChildren +" "+ d.depth +" "+ maxDepth)}
            }
        }
        
        function makePathId(x) {
            if (x) {
                var pId = makePathId(x.parent);
                return pId+"__"+x.name.replace(/\W+/g, "_");
            }
            return "ID";
        }
    }

    nrl2html.questionToJson("NRL/index.txt", nrl2html.treeGraph);
     //nrl2html.questionToJson("http://www.iris.edu/NRL/dataloggers/reftek/rt130.txt", nrl2html.treeGraph);

    function pullParam(val) {
        var es = val.indexOf("=");
        return val.substring(es+1).trim();
    }
    
    function dequote(val) {
        var out = val.trim();
        if (out.charAt(0) == '"') {
            out = out.substring(1, out.length);
        } else {
            console.log("missing start quote: '"+out.charAt(0)+"' "+out);
        }
        if (out.charAt(out.length - 1) == '"') {
            out = out.substring(0, out.length - 1);
        } else {
            console.log("missing end quote: '"+out.charAt(out.length - 1)+"' "+out);
        }
        return out;
    }
    
});
