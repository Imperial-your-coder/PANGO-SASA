document.addEventListener('DOMContentLoaded', function() {
           
            const map = L.map('map').setView([-4.43871, 15.2671], 19);

            const baseLayer = L.tileLayer('./{z}/{x}/{y}.png', {
                minZoom: 15,
                maxZoom: 24,
                tms: false,
                attribution: 'Créé par Elisée Nsenda'
            }).addTo(map);

            const marker = L.marker([-4.43871, 15.2671]).addTo(map);
            marker.bindPopup("<b>Commune</b><br>Annexe").openPopup();


           // Mettre à jour l'affichage du zoom initial
            document.getElementById('zoom-level-display').textContent = map.getZoom();

            // Écouter les changements de zoom
            map.on('zoomend', function() {
                document.getElementById('zoom-level-display').textContent = map.getZoom();
            });


            const drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);

            const drawControl = new L.Control.Draw({
                position: 'topright',
                draw: {
                    polygon: {
                        allowIntersection: false,
                        showArea: false,
                        metric: true,
                        shapeOptions: {
                            color: '#ffd700',
                            fillColor: '#ffd700',
                            fillOpacity: 0.2,
                            weight: 2
                        }
                    },
                    polyline: false,
                    circle: false,
                    marker: false,
                    circlemarker: false,
                    rectangle: false
                },
                edit: {
                    featureGroup: drawnItems
                }
            });

            let currentDrawControl = null;
            let currentParcel = null;
            let currentParcelPhoto = null;
            const parcels = [];

            const drawBtn = document.getElementById('draw-parcel');
            const cancelDrawBtn = document.getElementById('cancel-draw');
            const parcelForm = document.getElementById('parcelForm');
            const saveParcelBtn = document.getElementById('save-parcel');
            const cancelFormBtn = document.getElementById('cancel-form');
            const avatarPreview = document.getElementById('avatar-preview');
            const ownerPhotoInput = document.getElementById('owner-photo');
            const parcelInfoModal = document.getElementById('parcelInfoModal');
            const closeInfoBtn = document.getElementById('close-info');
            const requestModBtn = document.getElementById('request-modification');

            ownerPhotoInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        avatarPreview.src = event.target.result;
                        avatarPreview.style.display = 'block';
                        currentParcelPhoto = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });

            drawBtn.addEventListener('click', function() {
                if (currentDrawControl) {
                    map.removeControl(currentDrawControl);
                }
                
                currentDrawControl = drawControl;
                map.addControl(currentDrawControl);
                
                drawBtn.classList.add('hidden');
                cancelDrawBtn.classList.remove('hidden');
            });

            cancelDrawBtn.addEventListener('click', function() {
                cancelDrawing();
            });

            function configureParcelInteractions(parcel) {
                // Tooltip au survol
                parcel.layer.bindTooltip(`
                    <div style="min-width: 150px">
                        <h4 style="margin: 0 0 5px 0; font-weight: bold">${parcel.name}</h4>
                        <p style="margin: 0 0 3px 0"><strong>Statut:</strong> ${parcel.status}</p>
                        ${parcel.owner ? `<p style="margin: 0 0 3px 0"><strong>Propriétaire:</strong> ${parcel.owner}</p>` : ''}
                        <p style="margin: 0"><strong>Superficie:</strong> ${parcel.area} m²</p>
                    </div>
                `, {
                    permanent: false, 
                    sticky: true,
                    direction: 'top',
                    opacity: 0.9,
                    className: 'custom-tooltip'
                });

                // Clic pour afficher les détails complets
                parcel.layer.on('click', function(e) {
                    showParcelInfo(parcel);
                    map.setView(e.latlng, map.getZoom());
                });
            }



        async function saveParcelToDatabase(parcelData) {
            try {
                // Créer un FormData pour l'envoi des fichiers et données
                const formData = new FormData();
                
                // Préparer les données pour correspondre à la structure de la BDD
                const dbParcelData = {
                    nom: parcelData.name,
                    statut: parcelData.status,
                    surface: parcelData.area,
                    coordonnees: JSON.stringify(parcelData.coordinates), // Convertir en JSON string
                    proprietaire_nom: parcelData.status === 'occupee' ? parcelData.owner : null,
                    proprietaire_phone: parcelData.status === 'occupee' ? parcelData.phone : null,
                    date_acquisition: parcelData.status === 'occupee' ? parcelData.purchase_date : null
                };

                // Ajouter les données JSON
                formData.append('data', JSON.stringify(dbParcelData));

                // Ajouter l'image si elle existe
                if (parcelData.photo) {
                    const blob = dataURItoBlob(parcelData.photo);
                    formData.append('photo', blob, 'parcel-photo.jpg');
                }

                // Envoyer les données au serveur
                const response = await fetch('./API/insertData.php', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Erreur HTTP! Statut: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    // Ajouter les champs supplémentaires pour l'affichage
                    const completeParcelData = {
                        ...dbParcelData,
                        id: result.id,
                        coordinates: parcelData.coordinates, // Garder le format array pour la carte
                        photo: parcelData.photo,
                        owner: parcelData.owner,
                        phone: parcelData.phone,
                        purchase_date: parcelData.purchase_date
                    };
                    
                    addParcelToMap(completeParcelData);
                    resetForm();
                    alert('Parcelle enregistrée avec succès!');
                    return result;
                } else {
                    throw new Error(result.message || 'Erreur inconnue');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert(`Échec de l'enregistrement: ${error.message}`);
                throw error;
            }
        }

        function updateParcelCount() {
            const count = parcels.length;
            document.getElementById('parcelle-nbr').textContent = count;
        }


        // Fonction utilitaire pour convertir base64 en Blob
        function dataURItoBlob(dataURI) {
            const byteString = atob(dataURI.split(',')[1]);
            const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            
            return new Blob([ab], {type: mimeString});
        }

            function resetForm() {
                document.getElementById('parcelForm').style.display = 'none';
                document.getElementById('parcel-name').value = '';
                document.getElementById('parcel-area').value = '';
                document.getElementById('parcel-owner').value = '';
                document.getElementById('parcel-phone').value = '';
                document.getElementById('parcel-date').value = '';
                document.getElementById('owner-photo').value = '';
                avatarPreview.style.display = 'none';
                avatarPreview.src = '';
                currentParcel = null;
            }

            // Fonction pour charger les parcelles existantes
            async function loadParcelsFromDatabase() {
                try {
                    const response = await fetch('./API/getData.php');
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const text = await response.text();
                    
                    const parcelsData = JSON.parse(text);

                    
                    parcelsData.forEach(parcel => {
                        if (parcel.coordonnees && parcel.coordonnees.length > 0) {
                            addParcelToMap(parcel);
                        }
                    });
                    updateParcelCount();
                } catch (error) {
                    console.error('Error loading parcels:', error);
                    // Optionnel: Afficher un message à l'utilisateur
                }
            }

            // Fonction pour ajouter une parcelle à la carte
            function addParcelToMap(parcelData) {
                // Vérifier et convertir les coordonnées
                const coordinates = Array.isArray(parcelData.coordonnees) 
                ? parcelData.coordonnees 
                : JSON.parse(parcelData.coordonnees.replace(/\\/g, ''));

                // Vérifier que les coordonnées sont valides
                if (!coordinates || coordinates.length === 0) {
                    console.error('Coordonnées invalides pour la parcelle:', parcelData.id);
                    return;
                }

                // Inverser lat/lng si nécessaire (Leaflet utilise [lat, lng])
                const formattedCoords = coordinates.map(coord => {
                    // Si c'est [lng, lat], inverser
                    return coord.length === 2 && coord[0] > coord[1] ? [coord[1], coord[0]] : coord;
                });

                const style = {
                    libre: { color: '#48bb78', fillColor: '#48bb78', fillOpacity: 0.5, weight: 3 },
                    occupee: { color: '#e53e3e', fillColor: '#e53e3e', fillOpacity: 0.5, weight: 3 },
                    litige: { color: '#d69e2e', fillColor: '#d69e2e', fillOpacity: 0.5, weight: 3 }
                }[parcelData.statut];

                const parcelLayer = L.polygon(formattedCoords, style).addTo(drawnItems);

                // Création de l'objet parcelle avec les nouveaux noms de champs
                const parcel = {
                    id: parcelData.id,
                    name: parcelData.nom,
                    status: parcelData.statut,
                    area: parcelData.surface,
                    coordinates: parcelData.coordonnees,
                    owner: parcelData.proprietaire_nom || parcelData.proprietaire,
                    phone: parcelData.proprietaire_phone || parcelData.phone,
                    purchase_date: parcelData.date_acquisition,
                    photo: parcelData.photo,
                    layer: parcelLayer
                };
                
                parcels.push(parcel);
                updateParcelCount();
                configureParcelInteractions(parcel);
            }

           loadParcelsFromDatabase();




            function updateAreaDisplay(layer) {
                const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
                const areaRounded = Math.round(area);
                document.getElementById('area-display').textContent = `${areaRounded} m²`;
                
                // Mettre aussi à jour le champ du formulaire si ouvert
                const areaInput = document.getElementById('parcel-area');
                if (areaInput) {
                    areaInput.value = areaRounded;
                }
            }





            map.on(L.Draw.Event.CREATED, function(e) {
                const layer = e.layer;
                currentParcel = layer;
                drawnItems.addLayer(layer);


                updateAreaDisplay(layer);
                
                // Mettre à jour la superficie si la forme est modifiée
                layer.on('edit', function() {
                    updateAreaDisplay(layer);
                });
                
                document.getElementById('parcel-name').value = '';
                document.getElementById('parcel-owner').value = '';
                document.getElementById('parcel-status').value = 'libre';
                document.getElementById('parcel-area').value = '';
                avatarPreview.style.display = 'none';
                avatarPreview.src = '';
                ownerPhotoInput.value = '';
                currentParcelPhoto = null;
                
                parcelForm.style.display = 'block';
                
                if (currentDrawControl) {
                    map.removeControl(currentDrawControl);
                    currentDrawControl = null;
                }
            });

         saveParcelBtn.addEventListener('click', function() {
            if (!currentParcel) {
                alert("Veuillez d'abord dessiner une parcelle");
                return;
            }

            const status = document.getElementById('parcel-status').value;
            const name = document.getElementById('parcel-name').value;
            const area = document.getElementById('parcel-area').value;

            if (!name || !area) {
                alert('Les champs obligatoires ne sont pas remplis');
                return;
            }

            const parcelData = {
                name: name,
                status: status,
                area: area,
                coordinates: currentParcel.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]),
                photo: currentParcelPhoto
            };

            // Ajout des champs si parcelle occupée
            if (status === 'occupee') {
                parcelData.owner = document.getElementById('parcel-owner').value;
                parcelData.phone = document.getElementById('parcel-phone').value;
                parcelData.purchase_date = document.getElementById('parcel-date').value;
            }

            // Envoi des données au serveur
            saveParcelToDatabase(parcelData);
        });
        
        
        
            
        
        
            cancelFormBtn.addEventListener('click', function() {
                cancelDrawing();
                parcelForm.style.display = 'none';
            });

            closeInfoBtn.addEventListener('click', function() {
                parcelInfoModal.style.display = 'none';
            });

            requestModBtn.addEventListener('click', function() {
                parcelInfoModal.style.display = 'none';
                
            });

            function cancelDrawing() {
                if (currentDrawControl) {
                    map.removeControl(currentDrawControl);
                    currentDrawControl = null;
                }
                
                if (currentParcel) {
                    drawnItems.removeLayer(currentParcel);
                    currentParcel = null;
                }
                
                // Réinitialiser l'affichage de la superficie
                document.getElementById('area-display').textContent = '0 m²';
                
                drawBtn.classList.remove('hidden');
                cancelDrawBtn.classList.add('hidden');
            }

            function createParcelPopupContent(parcel) {
                return `
                    <div style="min-width: 200px">
                        <h4 style="margin: 0 0 5px 0; font-weight: bold">${parcel.name}</h4>
                        <p style="margin: 0 0 3px 0"><strong>Statut:</strong> ${parcel.status}</p>
                        <p style="margin: 0 0 3px 0"><strong>Propriétaire:</strong> ${parcel.owner}</p>
                        <p style="margin: 0"><strong>Superficie:</strong> ${parcel.area} m²</p>
                    </div>
                `;
            }

            function getStatusColor(status) {
                const colors = {
                    libre: '#48bb78', // vert
                    occupee: '#e53e3e', // rouge
                    litige: '#d69e2e'  // orange
                };
                return colors[status] || '#48bb78'; // vert par défaut
            }

            function showParcelInfo(parcel) {
                // Vérifier que la modal existe
                const modal = document.getElementById('parcelInfoModal');
                if (!modal) {
                    console.error('Modal Introuvable');
                    return;
                }

                // Fonction helper pour mettre à jour les champs
                function updateField(id, value, isImage = false) {
                    const element = document.getElementById(id);
                    if (!element) return;

                    if (isImage) {
                        // Gestion spéciale pour les images
                        element.onerror = function() {
                            this.src = './assets/default-avatar.jpg';
                            this.style.display = 'block';
                        };

                        if (value) {
                            // Vérifier si c'est une URL data ou un chemin de fichier
                            element.src = value.startsWith('data:image') || value.startsWith('http') 
                                ? value 
                                : `./uploads/parcelles/${value}`;
                            element.style.display = 'block';
                        } else {
                            element.src = './assets/default-avatar.jpg';
                            element.style.display = 'block';
                        }
                    } else {
                        // Gestion standard pour les textes
                        element.textContent = value || '-';
                    }
                }

                // Mettre à jour tous les champs avec les données de la parcelle
                updateField('parcel-info-title', parcel.nom || parcel.name);
                updateField('parcel-info-id', parcel.id);
                updateField('parcel-info-name', parcel.nom || parcel.name);
                updateField('parcel-info-status', parcel.statut || parcel.status);
                
                // Gestion du propriétaire (peut venir de différents champs selon la source)
                const ownerName = parcel.proprietaire_nom || parcel.proprietaire || parcel.owner;
                updateField('parcel-info-owner', ownerName);
                
                // Gestion de la surface
                const area = parcel.surface || parcel.area;
                updateField('parcel-info-area', area ? `${area} m²` : null);
                
                // Gestion du téléphone (peut venir de différents champs)
                const phone = parcel.proprietaire_phone || parcel.phone;
                updateField('parcel-info-phone', phone);
                
                // Gestion de la date (peut avoir des noms différents)
                const date = parcel.date_acquisition || parcel.purchase_date;
                updateField('parcel-info-date', date);
                
                // Gestion de la photo
                updateField('parcel-info-avatar', parcel.photo, true);

                // Afficher ou masquer les sections selon le statut
                const ownerSection = document.getElementById('parcel-info-owner-section');
                if (ownerSection) {
                    ownerSection.style.display = (parcel.statut === 'occupee' || parcel.status === 'occupee') 
                        ? 'block' 
                        : 'none';
                }

                // Positionner et afficher la modal
                modal.style.display = 'block';
                modal.style.top = `${window.scrollY + 20}px`;
                modal.style.left = '50%';
                modal.style.transform = 'translateX(-50%)';

                // Ajouter l'ID de la parcelle au bouton de demande
                const requestBtn = document.getElementById('request-modification');
                if (requestBtn) {
                    requestBtn.setAttribute('data-parcel-id', parcel.id);
                    
                    // Mettre à jour le style selon le statut
                    if (parcel.statut === 'litige' || parcel.status === 'litige') {
                        requestBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
                    } else {
                        requestBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
                    }
                }
            }


            const SoundFX = {
                search: new Audio('./sounds/search_ping.mp3'),
                play: (sound) => {
                    sound.currentTime = 0;
                    sound.volume = 0.3;
                    sound.play().catch(e => console.log("Son bloqué:", e));
                }
            };


            map.on('mousemove', function(e) {
                document.getElementById('latitude').textContent = e.latlng.lat.toFixed(6);
                document.getElementById('longitude').textContent = e.latlng.lng.toFixed(6);
            });

            function animateStat(element) {
                element.classList.add('stat-update');
                setTimeout(() => element.classList.remove('stat-update'), 300);
            }



            // Fonctionnalité de recherche
            const searchInput = document.getElementById('parcelSearch');
            const searchButton = document.getElementById('searchButton');

           async function searchParcel() {
                // 1. Initialisation
                const searchInput = document.getElementById('parcelSearch');
                if (!searchInput || !searchInput.value.trim()) {
                    alert("Veuillez entrer un terme de recherche");
                    return;
                }

                // 2. Activer les effets visuels
                searchInput.classList.add('search-active');
                const searchStartTime = performance.now();
                let radarTurns = 0;
                const maxTurns = Math.floor(Math.random() * 3) + 2; // 2-4 tours aléatoires

                // 3. Création du conteneur radar
                const radarContainer = L.layerGroup().addTo(map);
                let radarAngle = 0;
                
                // 4. Fonction pour convertir des coordonnées polaires en LatLng
                function getRadarEdgePoint(center, angle, radius) {
                    const rad = angle * Math.PI / 180;
                    return L.latLng(
                        center.lat + (radius / 111320) * Math.cos(rad),
                        center.lng + (radius / (111320 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(rad)
                    );
                }

                // 5. Animation du radar (fonction récursive)
                function animateRadar() {
                    const center = map.getCenter();
                    const radius = Math.min(map.getSize().x, map.getSize().y) * 0.7;
                    
                    // Calcul des points du secteur radar (60 degrés)
                    const sectorPoints = [center];
                    for (let angle = radarAngle; angle <= radarAngle + 60; angle += 2) {
                        sectorPoints.push(getRadarEdgePoint(center, angle, radius));
                    }
                    sectorPoints.push(center);
                    
                    // Création/Mise à jour du polygone radar
                    if (!radarContainer._radarPolygon) {
                        radarContainer._radarPolygon = L.polygon(sectorPoints, {
                            color: '#00ff00',
                            weight: 2,
                            fillOpacity: 0.1,
                            className: 'radar-sweep'
                        }).addTo(radarContainer);
                    } else {
                        radarContainer._radarPolygon.setLatLngs(sectorPoints);
                    }
                    
                    // Mise à jour de l'angle et du compteur de tours
                    radarAngle = (radarAngle + 3) % 360;
                    if (radarAngle === 0) radarTurns++;
                    
                    // Continuer ou arrêter l'animation
                    if (radarTurns < maxTurns) {
                        requestAnimationFrame(animateRadar);
                    } else {
                        finishRadarAnimation();
                    }
                }

                // 6. Finalisation de l'animation radar
                function finishRadarAnimation() {
                    radarContainer.remove();
                    processSearchResults();
                }

                // 7. Traitement des résultats de recherche
                async function processSearchResults() {
                    const searchTerm = searchInput.value.trim().toLowerCase();
                    const foundParcels = parcels.filter(parcel => {
                        if (!parcel || !parcel.layer) return false;

                        const searchFields = [
                            parcel.name?.toLowerCase(),
                            parcel.owner?.toLowerCase(),
                            parcel.id?.toString(),
                            parcel.status?.toLowerCase()
                        ];

                        return searchFields.some(field => field?.includes(searchTerm));
                    });

                    // Mise à jour des statistiques
                    document.getElementById('parcelle-nbr').textContent = foundParcels.length;
                    document.getElementById('search-time').textContent = 
                        `${(performance.now() - searchStartTime).toFixed(0)} ms`;

                    // Traitement des résultats
                    if (foundParcels.length > 0) {
                        await highlightAndZoomParcels(foundParcels);
                    } else {
                        alert("Aucune parcelle trouvée");
                    }

                    // Nettoyage final
                    searchInput.classList.remove('search-active');
                }

                // 8. Mise en avant des parcelles trouvées
                async function highlightAndZoomParcels(parcelsToHighlight) {
                    // Sauvegarde des styles originaux
                    const originalStyles = parcelsToHighlight.map(parcel => ({
                        layer: parcel.layer,
                        originalStyle: {...parcel.layer.options}
                    }));

                    // Clignotement (3 fois)
                    for (let i = 0; i < 3; i++) {
                        // Phase claire
                        parcelsToHighlight.forEach(parcel => {
                            parcel.layer.setStyle({
                                color: '#ffffff',
                                fillColor: '#ffffff',
                                weight: 4
                            });
                        });
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Phase normale
                        parcelsToHighlight.forEach(parcel => {
                            parcel.layer.setStyle({
                                color: getStatusColor(parcel.status),
                                fillColor: getStatusColor(parcel.status),
                                weight: 2
                            });
                        });
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }

                    // Restauration exacte des styles originaux
                    originalStyles.forEach(({layer, originalStyle}) => {
                        layer.setStyle(originalStyle);
                    });

                    // Zoom adapté
                    if (parcelsToHighlight.length === 1) {
                        // Zoom sur une seule parcelle
                        map.flyToBounds(parcelsToHighlight[0].layer.getBounds(), {
                            padding: [100, 100],
                            duration: 1
                        });
                    } else {
                        // Zoom pour montrer toutes les parcelles
                        const group = L.featureGroup(parcelsToHighlight.map(p => p.layer));
                        map.flyToBounds(group.getBounds(), {
                            padding: [50, 50],
                            duration: 1
                        });
                    }
                }

                // 9. Démarrer l'animation
                animateRadar();
            }

            // Fonction pour l'effet radar
            async function showRadarEffect(turns) {
                const radarContainer = L.layerGroup().addTo(map);
                let completedTurns = 0;
                
                return new Promise(resolve => {
                    const animate = () => {
                        if (++completedTurns >= turns) {
                            radarContainer.remove();
                            resolve();
                        } else {
                            requestAnimationFrame(animate);
                        }
                    };
                    animate();
                });
            }

            // Traitement des parcelles trouvées
            async function processFoundParcels(parcels) {
                // 1. Clignotement groupé
                await blinkParcels(parcels, 3);
                
                // 2. Zoom adaptatif
                if (parcels.length === 1) {
                    // Zoom centré sur une seule parcelle
                    map.flyToBounds(parcels[0].layer.getBounds(), {
                        padding: [100, 100],
                        duration: 1
                    });
                } else {
                    // Zoom pour englober toutes les parcelles
                    const group = new L.featureGroup(parcels.map(p => p.layer));
                    map.flyToBounds(group.getBounds(), {
                        padding: [50, 50],
                        duration: 1
                    });
                }
                
                // 3. Mise en avant durable
                parcels.forEach(p => {
                    p.layer.bringToFront();
                    p.layer.setStyle({ weight: 4 });
                });
            }

            // Fonction de clignotement améliorée
            async function blinkParcels(parcels, times) {
                const originalStyles = parcels.map(p => ({
                    layer: p.layer,
                    style: {...p.layer.options}
                }));

                for (let i = 0; i < times; i++) {
                    // Flash blanc
                    parcels.forEach(p => p.layer.setStyle({
                        color: '#ffffff',
                        fillColor: '#ffffff',
                        weight: 5
                    }));
                    await new Promise(r => setTimeout(r, 200));
                    
                    // Retour à la normale
                    parcels.forEach(p => p.layer.setStyle({
                        color: getStatusColor(p.status),
                        fillColor: getStatusColor(p.status),
                        weight: 3
                    }));
                    await new Promise(r => setTimeout(r, 200));
                }
                
             
                originalStyles.forEach(({layer, style}) => layer.setStyle(style));
            }
            // Fonction externe nécessaire
            function cyberCount(element, target, options = {}) {
                const { duration = 1000, startValue = 0 } = options;
                const start = performance.now();
                const initialValue = parseInt(element.textContent) || startValue;
                const increment = (target - initialValue) / (duration / 16);

                const animate = () => {
                    const elapsed = performance.now() - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const currentValue = Math.floor(initialValue + (target - initialValue) * progress);
                    
                    element.textContent = currentValue;
                    
                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        element.textContent = target;
                    }
                };
                
                animate();
            }



            // Écouteurs d'événements
            searchButton.addEventListener('click', searchParcel);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') searchParcel();
            });



            // Gestion de l'affichage conditionnel
            document.getElementById('parcel-status').addEventListener('change', function() {
                const occupiedFields = document.getElementById('occupied-fields');
                if (this.value === 'occupee') {
                    occupiedFields.style.display = 'block';
                } else {
                    occupiedFields.style.display = 'none';
                }
            });







            window.addEventListener('resize', function() {
                map.invalidateSize();
            });

            // Nouveau code pour gérer la navbar et sidebar pliable
            const navbarToggle = document.getElementById('navbarToggle');
            const navbar = document.getElementById('navbar');
            const sidebarToggle = document.getElementById('sidebarToggle');
            const sidebar = document.getElementById('sidebar');
            const toggleParcels = document.getElementById('toggleParcels');

            // Toggle navbar
            navbarToggle.addEventListener('click', function() {
                navbar.style.display = navbar.style.display === 'flex' ? 'none' : 'flex';
            });

            // Toggle sidebar
            sidebarToggle.addEventListener('click', function() {
                sidebar.classList.toggle('collapsed');
            });

            // Toggle parcelles
            toggleParcels.addEventListener('change', function() {
                if (this.checked) {
                    map.addLayer(drawnItems);
                } else {
                    map.removeLayer(drawnItems);
                }
            });
        });
   




// Modification parcelle

// Variables globales
let currentParcelId = document.getElementById('parcel-info-id').textContent; // Stocke l'ID de la parcelle concernée

// Fonction pour afficher le modal de demande
function showModificationRequestModal(parcelId) {
    currentParcelId = parcelId;
    document.getElementById('modificationRequestModal').style.display = 'block';
}

// Fonction pour envoyer la demande
async function submitModificationRequest() {
    const justification = document.getElementById('request-justification').value.trim();
    const parcelId = document.getElementById('request-modification').getAttribute('data-parcel-id');
    
    console.log("ID Parcelle à envoyer:", parcelId); // Debug

    if (!parcelId) {
        alert('Erreur: Parcelle non identifiée');
        return;
    }

    if (!justification) {
        alert('Veuillez fournir une justification');
        return;
    }

    try {
        // Récupérer l'ID de l'agent connecté
        const authData = JSON.parse(localStorage.getItem('pango_sasa_auth'));
        const agentId = authData?.user?.id;
        
        if (!agentId) {
            throw new Error('Agent non identifié - Veuillez vous reconnecter');
        }

        const response = await fetch('./API/DemandeController.php?action=create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authData.token}` // Si vous utilisez JWT
            },
            body: JSON.stringify({
                id_parcelle: parseInt(parcelId), // Conversion en number
                id_agent: agentId,
                justification: justification
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur serveur');
        }

        const result = await response.json();

        if (result.success) {
            alert('Demande envoyée avec succès!');
            closeAllModals();
            updateParcelStatus(parcelId, 'en_attente');
        } else {
            throw new Error(result.message || 'Erreur lors de l\'envoi');
        }
    } catch (error) {
        console.error('Erreur détaillée:', error);
        alert(`Échec de l'envoi: ${error.message}`);
    }
}


// Fonction pour mettre à jour l'affichage du statut
function updateParcelStatus(parcelId, status) {
    const parcelElement = document.querySelector(`[data-parcel-id="${parcelId}"]`);
    if (!parcelElement) return;

    const requestBtn = document.getElementById('request-modification');
    
    switch(status) {
        case 'en_attente':
            requestBtn.textContent = 'Demande en cours...';
            requestBtn.className = 'w-full px-4 py-2 bg-gray-500 text-white rounded mb-2 cursor-not-allowed';
            requestBtn.disabled = true;
            break;
            
        case 'approuvee':
            requestBtn.style.display = 'none';
            // Afficher le formulaire d'édition
            document.getElementById('parcelForm').style.display = 'block';
            // Pré-remplir avec les données existantes (à implémenter)
            break;
            
        case 'rejetee':
            requestBtn.textContent = 'Demande rejetée - Nouvelle demande';
            requestBtn.className = 'w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 mb-2';
            requestBtn.disabled = false;
            break;
    }
}

// Fonction pour fermer tous les modals
function closeAllModals() {
    document.getElementById('parcelInfoModal').style.display = 'none';
    document.getElementById('modificationRequestModal').style.display = 'none';
}

// Écouteurs d'événements
document.addEventListener('DOMContentLoaded', function() {
    // Gestion de la demande de modification
    document.getElementById('request-modification').addEventListener('click', function() {
        const parcelId = this.getAttribute('data-parcel-id');
        showModificationRequestModal(parcelId);
    });

    // Envoi de la demande
    document.getElementById('submit-request').addEventListener('click', submitModificationRequest);

    // Annulation
    document.getElementById('cancel-request').addEventListener('click', closeAllModals);
    
    // Vérification initiale du statut
    checkInitialStatus();
});

// Vérifier le statut au chargement
async function checkInitialStatus() {
    const parcelId = document.getElementById('request-modification')?.getAttribute('data-parcel-id');
    if (!parcelId) return;

    try {
        const response = await fetch(`./API/DemandeController.php?action=check_status&parcel_id=${parcelId}`);
        const result = await response.json();
        
        if (result.success && result.status) {
            updateParcelStatus(parcelId, result.status);
        }
    } catch (error) {
        console.error('Erreur vérification statut:', error);
    }
}