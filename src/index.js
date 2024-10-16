import initOpenCascade from "opencascade.js";
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Group,
  Raycaster,
  SphereGeometry
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { loadSTEPorIGES, setupThreeJSViewport } from './library';
import visualize from './visualize';
import { saveAs } from 'file-saver';

const addShapeToScene = async (openCascade, shape, scene) => {
  const objectMat = //new MeshStandardMaterial({
    //color: new Color(0.4, 0.4, 0.6)
  //});
    new MeshStandardMaterial({vertexColors: true, roughness: 0.4,
         metalness: 0.7});
    

  let geometries = visualize(openCascade, shape);

  document.group = new Group();
  geometries.forEach(geometry => {
    document.group.add(new Mesh(geometry, objectMat));
  });

  document.group.name = "shape";
  document.group.rotation.x = -Math.PI / 2;
  document.shape = shape;
  scene.add(document.group);
}

var inputs = document.getElementsByTagName('input');
for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].type == 'text')
        inputs[i].value = '';
}

document.getElementById('openFileInput').addEventListener('change', function(e) {
  if (e.target.files[0]) {
	var tmppath = URL.createObjectURL(event.target.files[0]);
    var inputs = document.getElementsByTagName('input');
    for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].type == 'text')
            inputs[i].value = '';
    }
    //this.value = e.target.files[0].name;
  }
});

window.deleteAnnotations = () => {
	if (document.scene !== undefined)
	{
		var nodes = [];
		document.scene.children.forEach(x => {
			if (x.name == 'annotation' || x.constructor.name == 'CSS2DObject')
			{
				nodes.push(x);
			}
		});
		
	    nodes.forEach(x => { document.scene.remove(x) } );
	}
}

window.saveScene = () => {
  var fileName = document.getElementById('openFileInput').value;
  fileName = fileName.split(/[\\/]/).pop();
  var seps = fileName.split('.');
  var modelFileType = seps.at(-1);
  seps.pop();
  fileName = seps.join('.');
         
  var annotations = []
  document.scene.children.forEach(css => {
        if (css.constructor.name == 'CSS2DObject')
        {
            annotations.push({text: css.element.children[0].innerHTML, x: css.position.x, y: css.position.y, z: css.position.z});
        }
    });
    
  var file = {
    name: fileName,
    type: modelFileType,
    annotations: annotations
  }
  
  var jsonData = JSON.stringify(file);
  var data = jsonData.length.toString() + '\n' + jsonData + '\n' + document.fileContent;
  var blob = new Blob([data], { type: 'application/text' });
  saveAs(blob, fileName+".saeki");
}

var createFile = async (path, name, type) => {
            let response = await fetch(path);
            let data = await response.blob();
            let metadata = {
                type: type
            };
            return new File([data], name, metadata);
}

var openSaekiFile = async (openCascade, file_to_read) => {
  var fileread = new FileReader();
  fileread.onload = async function(e) {
    var content = e.target.result;
	var lines = content.split('\n');
	var jsonText = '';
	var jsonSize = 0;
	var modelText = '';
	var firstPart = true;
	
	jsonSize = parseInt(lines[0]);
	for (var i = 1; i < lines.length; i++)
	{
		if (firstPart)
		{
			jsonText += lines[i] + '\n';
			if (jsonText.length >= jsonSize)
				firstPart = false;
		}
		else
		{
			modelText += lines[i] + '\n';
		}
	}
	
    var file = JSON.parse(jsonText);
    
	const fileType = (() => {
		switch (file.type.toLowerCase()) {
		case "step":
		case "stp":
		  return "step";
		case "iges":
		case "igs":
		  return "iges";
		default:
		  return undefined;
	}})();
		  
    await loadSTEPorIGES(openCascade, undefined, modelText, fileType, addShapeToScene, document.scene);
	
	for (var n = 0; n < file.annotations.length; n++)
	{
	  const annotation = file.annotations[n];
	  
      const element = document.createElement("div");
	  element.className = "element";
	  element.style.color = 'white';
	  element.style.fontSize = '10pt';

	  const details = document.createElement("p");
	  details.innerHTML = annotation.text;
	  details.style.position = 'relative';
	  details.style.top = '-15px';
	  element.appendChild(details);

	  const objectCSS = new CSS2DObject(element);
	  objectCSS.position.x = annotation.x;	
	  objectCSS.position.y = annotation.y;
	  objectCSS.position.z = annotation.z;
	  document.scene.add(objectCSS);
	  
	  const geometry = new SphereGeometry(0.3, 10, 5 );
	  geometry.translate(annotation.x, annotation.y, annotation.z);
	  const material = new MeshBasicMaterial( { color: 0xffffff } );
	  const sphere = new Mesh( geometry, material );
	  sphere.name = 'annotation';
	  document.scene.add( sphere );
	}
  };
  fileread.readAsText(file_to_read);
}

initOpenCascade().then(openCascade => {
    const scene = setupThreeJSViewport(openCascade);
  // Allow users to upload STEP Files by either "File Selector" or "Drag and Drop".
  document.getElementById("openFileInput").addEventListener(
    'input', async (event) => { 
    if (event.srcElement.files[0].name.endsWith('.saeki'))
    {
        openSaekiFile(openCascade, event.srcElement.files[0]);
    }
    else
    {
        await loadSTEPorIGES(openCascade, event.srcElement.files[0], undefined, undefined, addShapeToScene, scene);
    }
 });
  document.body.addEventListener("dragenter", (e) => { e.stopPropagation(); e.preventDefault(); }, false);
  document.body.addEventListener("dragover", (e) => { e.stopPropagation(); e.preventDefault(); }, false);
  document.body.addEventListener("drop", (e) => {
    e.stopPropagation(); e.preventDefault();
    if (e.dataTransfer.files[0]) { 
        if (event.dataTransfer.files[0].name.endsWith('.saeki'))
        {
            openSaekiFile(openCascade, event.dataTransfer.files[0]);
        }
        else
        {
            loadSTEPorIGES(openCascade, e.dataTransfer.files[0], undefined, undefined, addShapeToScene, scene); 
        }
    }
  }, false);

});