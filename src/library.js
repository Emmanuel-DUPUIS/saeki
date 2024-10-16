import {
  AmbientLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Raycaster,
  SphereGeometry
} from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import openCascadeHelper from './openCascadeHelper';


const loadFileAsync = (file) => {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  })
}

const loadSTEPorIGES = async (openCascade, inputFile, fileContent, fileType2, addFunction, scene) => {
  var fileText = '';
  var fileType = '';
  if (inputFile !== undefined)
  {
	  await loadFileAsync(inputFile).then(async (text) => {
		fileText = text;
		fileType = (() => {
		  switch (inputFile.name.toLowerCase().split(".").pop()) {
			case "step":
			case "stp":
			  return "step";
			case "iges":
			case "igs":
			  return "iges";
			default:
			  return undefined;
		  }
		})();
	  });
  }
  else
  {
	  fileText = fileContent;
	  fileType = fileType2;
  }
  
  document.fileContent = fileText;
	
    // Writes the uploaded file to Emscripten's Virtual Filesystem
    openCascade.FS.createDataFile("/", `file.${fileType}`, fileText, true, true);

    // Choose the correct OpenCascade file parsers to read the CAD file
    var reader = null;
    if (fileType === "step") {
      reader = new openCascade.STEPControl_Reader_1();
    } else if (fileType === "iges") {
      reader = new openCascade.IGESControl_Reader_1();
    } else { console.error("opencascade.js can't parse this extension! (yet)"); }
    const readResult = reader.ReadFile(`file.${fileType}`);            // Read the file
    if (readResult === openCascade.IFSelect_ReturnStatus.IFSelect_RetDone) {
	  window.deleteAnnotations();
      console.log("file loaded successfully!     Converting to OCC now...");
      const numRootsTransferred = reader.TransferRoots(new openCascade.Message_ProgressRange_1());    // Translate all transferable roots to OpenCascade
      const stepShape = reader.OneShape();         // Obtain the results of translation in one OCCT shape
      console.log((inputFile === undefined ? 'Geometry container' : inputFile.name) + " converted successfully!  Triangulating now...");
    
  	  //alert(openCascade.TopAbs.ShapeTypeToString(stepShape.ShapeType()));
	  const computeModelDetails = async () => {

		  var it = new openCascade.TopoDS_Iterator_2(stepShape, true, true);
		  const shell = it.Value();
		  //alert(shell.NbChildren());
		  document.getElementById("FaceNumberInput").value = shell.NbChildren().toString();
		  
		  var bbox = new openCascade.Bnd_Box_1();
		  openCascade.BRepBndLib.Add(stepShape, bbox, false);
		  bbox.Dump();
		  // Not working: arguments not passed by reference!?
		  //var theXmin = -10, theYmin = -10, theZmin = -10, theXmax = -10, theYmax = -10, theZmax = -10;
		  //bbox.Get(theXmin, theYmin, theZmin, theXmax, theYmax, theZmax);
		  var minBBox = bbox.CornerMin();
		  var maxBBox = bbox.CornerMax();
		  
		  document.getElementById("BBoxXInput").value = (Math.round(minBBox.X())/1000).toString()+' -> '+(Math.round(maxBBox.X())/1000).toString();
		  document.getElementById("BBoxYInput").value = (Math.round(minBBox.Y())/1000).toString()+' -> '+(Math.round(maxBBox.Y())/1000).toString();
		  document.getElementById("BBoxZInput").value = (Math.round(minBBox.Z())/1000).toString()+' -> '+(Math.round(maxBBox.Z())/1000).toString();
		  
		  var nb = 0;
		  var area = 0.0;
		  var areaT = 0.0;
		  for (var expl = new openCascade.TopExp_Explorer_2(stepShape, openCascade.TopAbs_ShapeEnum.TopAbs_FACE, openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE); expl.More(); expl.Next())
		  {
			  const face = openCascade.TopoDS.Face_1(expl.Current());
			  const surface = openCascade.BRep_Tool.Surface_2(face).get();
			  //alert(surface.constructor.name);
			  var mp = new openCascade.GProp_GProps_1();
			  openCascade.BRepGProp.SurfaceProperties_1(face, mp, true, true);
			  var face_area = mp.Mass();
			  areaT += face_area;
			  
			  if (surface.IsKind_2(openCascade.Geom_Plane.name))
			  {
				  area += face_area;
				  nb++;
			  }
		  }
		  
		  document.getElementById("AreaPlanarFacesInput").value = (Math.round(area/100)/10000.0).toString() + ' ('+(Math.round(1000*area/areaT)/10.0).toString()+'%)';
		  //alert('nb=' + nb.toString() + '  area=' + area.toString() + '  areaT=' + areaT.toString());
		  
		  var solid_mp = new openCascade.GProp_GProps_1();
		  openCascade.BRepGProp.VolumeProperties_1(stepShape, solid_mp, true, true, true);
		  document.getElementById("VolumeInput").value = (Math.round(solid_mp.Mass()/1000)/1000000).toString();
		  openCascade.BRepGProp.SurfaceProperties_1(stepShape, solid_mp, true, true);
		  document.getElementById("WetSurfaceInput").value = (Math.round(solid_mp.Mass()/100)/10000.0).toString();
	  }
	  
	  const result = computeModelDetails();

      // Out with the old, in with the new!
      scene.remove(scene.getObjectByName("shape"));
      await addFunction(openCascade, stepShape, scene);
      console.log((inputFile === undefined ? 'Geometry container' : inputFile.name) + " triangulated and added to the scene!");

      // Remove the file when we're done (otherwise we run into errors on reupload)
      openCascade.FS.unlink(`/file.${fileType}`);
    } else {
      console.error("Something in OCCT went wrong trying to read " + (inputFile === undefined ? 'Geometry container' : inputFile.name));
	  alert("Something in OCCT went wrong trying to read " + (inputFile === undefined ? 'Geometry container' : inputFile.name));
    }
};
export { loadSTEPorIGES };


const setupThreeJSViewport = (openCascade) => {
  document.scene = new Scene();
  document.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  document.renderer = new WebGLRenderer({ antialias: true });
  document.viewport = document.getElementById("viewport");
  document.viewportRect = document.viewport.getBoundingClientRect();
  document.renderer.setSize(document.viewportRect.width, document.viewportRect.height);
  document.viewport.appendChild(document.renderer.domElement);

  var light = new AmbientLight(0xffffff);
  document.scene.add(light);
  const directionalLight1 = new DirectionalLight(0xffffff, 1.0);
  directionalLight1.position.set(0.5, 0.5, 0.5);
  document.scene.add(directionalLight1);
  const directionalLight2 = new DirectionalLight(0xffffff, 1.0);
  directionalLight2.position.set(-0.5, -0.5, -0.5);
  document.scene.add(directionalLight2);
  
  document.camera.position.set(0, 50, 100);

  const controls = new OrbitControls(document.camera, document.renderer.domElement);
  controls.screenSpacePanning = true;
  controls.target.set(0, 50, 0);
  controls.update();

  document.raycaster = new Raycaster();
  document.mouse = { x: 0, y: 0 };
  document.addEventListener('mousemove', (event) => {
    document.mouse.x =   (event.offsetX / document.viewportRect.width) * 2 - 1;
    document.mouse.y = - (event.offsetY / document.viewportRect.height) * 2 + 1;
  }, false );
  
  
  document.addEventListener('click', (event) => {
	  if (event.target.constructor.name == "HTMLCanvasElement")
	  {
		document.logClick = true;
		document.logCtrlClick = event.ctrlKey;
	  }
  }, false);
  
  document.cssrenderer = new CSS2DRenderer();
  document.cssrenderer.setSize(document.viewportRect.width, document.viewportRect.height);
  document.getElementById('css').appendChild(document.cssrenderer.domElement);
					  					  
  document.animate = function animation() {
 
    requestAnimationFrame(() => document.animate());
    document.renderer.render(document.scene, document.camera);
	document.cssrenderer.render(document.scene, document.camera);
			
	if (document.group != undefined)
	{
		document.raycaster.setFromCamera(document.mouse, document.camera);
		let intersects = document.raycaster.intersectObjects(document.group.children);
		var deselect = document.selectedFace !== undefined && 
		               (0 == intersects.length || (document.selectedFace.geometry.attributes.face_id.array[0] != intersects[0].object.geometry.attributes.face_id.array[0]));
				
		var needToRender = false;
		if (deselect)
		{
			var colors = [];
			for (var n = 0; n < document.selectedFace.geometry.attributes.color.array.length / 3; n++)
			{
				colors.push(0.3); colors.push(0.3); colors.push(0.8);
			}
			document.selectedFace.geometry.setAttribute('color', new Float32BufferAttribute( colors, 3 ) );
			needToRender = true;
		}	
		
		if (intersects.length > 0) {
			if (document.selectedFace == undefined || (document.selectedFace !== undefined && document.selectedFace.geometry.attributes.face_id.array[0] != intersects[0].object.geometry.attributes.face_id.array[0]))
			{
				var colors = [];
				for (var n = 0; n < intersects[0].object.geometry.attributes.color.array.length / 3; n++)
				{
					colors.push(1.0); colors.push(0.1); colors.push(0.1);
				}
				intersects[0].object.geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );
				needToRender = true;
			}	
			document.selectedFace = intersects[0].object;

			if (document.logClick)
			{
				document.logClick = false;
				
				for (var expl = new openCascade.TopExp_Explorer_2(document.shape, openCascade.TopAbs_ShapeEnum.TopAbs_FACE, openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE); expl.More(); expl.Next())
				{
					const face = openCascade.TopoDS.Face_1(expl.Current());
				    const face_id = face.HashCode(1000000);
				
					if (face_id == intersects[0].object.geometry.attributes.face_id.array[0])
					{
					  var uv = intersects[0].uv;
					  var sf = new openCascade.BRepAdaptor_Surface_2(face, true);
					  var sprops = new openCascade.BRepLProp_SLProps_1(sf, uv.x, uv.y, 1, 1e-5);
					  
					  var minc = sprops.MinCurvature();
					  var txtMin = Math.abs(minc) < 1e-12 ? '∞' : (Math.round(100.0/minc)/100).toString();
					  document.getElementById("MinCurvatureInput").value = (Math.round(minc*100000)/100000).toString()+' / '+txtMin;
		              var maxc = sprops.MaxCurvature();
					  var txtMax = Math.abs(maxc) < 1e-12 ? '∞' : (Math.round(100.0/maxc)/100).toString();
					  document.getElementById("MaxCurvatureInput").value = (Math.round(maxc*100000)/100000).toString()+' / '+txtMax;
		  
				      /*var label = new TextGeometry((Math.round(minc*100000)/100000).toString()+' / '+txtMin, { size: 100, depth: 0.01 } );
					  label.translate(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);
					  const material = new MeshBasicMaterial( { color: 0x00ff00 } );
					  const mesh = new Mesh(label, material);
					  document.scene.add(mesh);*/
					
					  if (document.logCtrlClick)
					  {
						  const element = document.createElement("div");
						  element.className = "element";
						  element.style.color = 'white';
						  element.style.fontSize = '10pt';

						  const details = document.createElement("p");
						  details.innerHTML = 'r1:' + txtMin + ',r2:' + txtMax;
						  details.style.position = 'relative';
						  details.style.top = '-15px';
						  element.appendChild(details);
			
						  const objectCSS = new CSS2DObject(element);
						  objectCSS.position.x = intersects[0].point.x;	
						  objectCSS.position.y = intersects[0].point.y;
						  objectCSS.position.z = intersects[0].point.z;
						  document.scene.add(objectCSS);
						  
						  const geometry = new SphereGeometry(0.3, 10, 5 );
						  geometry.translate(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);
						  const material = new MeshBasicMaterial( { color: 0xffffff } );
						  
						  const sphere = new Mesh( geometry, material );
						  sphere.name = 'annotation';
						  document.scene.add( sphere );
					  }
					  
					  break;
					}
				}
			}
			
		/*	if (needToRender)
			//{
				document.renderer.render(document.scene, document.camera);
				if (document.cssrenderer !== undefined)
					document.cssrenderer.render(document.scene, document.camera);
			}*/
		}
	}
  }
  
  document.animate();
  return document.scene;
}
export { setupThreeJSViewport };

/*const addShapeToScene = async (openCascade, shape, scene) => {
  openCascadeHelper.setOpenCascade(openCascade);
  const facelist = await openCascadeHelper.tessellate(shape);
  const [face_ids, locVertexcoord, locNormalcoord, locTriIndices] = await openCascadeHelper.joinPrimitives(facelist);
  const tot_triangle_count = facelist.reduce((a, b) => a + b.number_of_triangles, 0);
  const [vertices, faces] = await openCascadeHelper.generateGeometry(face_ids, tot_triangle_count, locVertexcoord, locNormalcoord, locTriIndices);

  const objectMat = new MeshStandardMaterial({
    color: new Color(0.9, 0.9, 0.9)
  });
  const geometry = new BufferGeometry();
  geometry.vertices = vertices;
  geometry.faces = faces;
  const object = new Mesh(geometry, objectMat);
  object.name = "shape";
  object.rotation.x = -Math.PI / 2;
  scene.add(object);
}
export { addShapeToScene };*/
