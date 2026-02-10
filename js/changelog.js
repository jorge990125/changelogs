document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('changelog');
    if (!container) {
        console.error('No se encontró #changelog');
        return;
    }
    
    // Mostrar carga
    container.innerHTML = `
        <li style="text-align: center; color: white; padding: 40px;">
            <div style="font-size: 1.2em; margin-bottom: 10px;">⏳ Cargando historial de cambios...</div>
            <div id="progress" style="color: rgba(255,255,255,0.8);">Iniciando...</div>
        </li>
    `;
    
    const progress = document.getElementById('progress');
    
    fetch('commits.json')
        .then(response => {
            progress.textContent = 'Descargando datos...';
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.text();
        })
        .then(text => {
            progress.textContent = 'Procesando JSON...';
            console.log('JSON tamaño:', text.length, 'caracteres');
            
            // Intentar parsear directamente primero
            try {
                const data = JSON.parse(text);
                console.log('✅ JSON parseado directamente:', data.length, 'commits');
                progress.textContent = `✅ Cargados ${data.length} commits`;
                displayCommits(data, container);
                return;
            } catch (directError) {
                console.log('Parseo directo falló, intentando limpiar...');
            }
            
            // Método 1: Limpieza suave
            progress.textContent = 'Limpiando formato JSON...';
            const cleaned = cleanJSON(text);
            
            try {
                const data = JSON.parse(cleaned);
                console.log('✅ JSON limpiado exitosamente:', data.length, 'commits');
                progress.textContent = `✅ Cargados ${data.length} commits (modo limpiado)`;
                displayCommits(data, container);
                return;
            } catch (cleanError) {
                console.log('Método 1 falló:', cleanError.message);
            }
            
            // Método 2: Extracción manual de objetos
            progress.textContent = 'Extrayendo datos manualmente...';
            const extractedData = extractJSONObjects(text);
            
            if (extractedData.length > 0) {
                console.log('✅ Extracción manual exitosa:', extractedData.length, 'commits');
                progress.textContent = `✅ Cargados ${extractedData.length} commits (modo extracción)`;
                displayCommits(extractedData, container);
                return;
            }
            
            // Si todo falla
            throw new Error('No se pudo procesar el archivo JSON');
        })
        .catch(error => {
            console.error('Error completo:', error);
            container.innerHTML = `
                <li style="background: #ffebee; color: #c62828; padding: 30px; border-radius: 10px; margin: 20px;">
                    <h3 style="margin-bottom: 15px;">❌ Error al cargar commits</h3>
                    <p><strong>${error.message}</strong></p>
                    <p style="margin-top: 15px;">
                        No se pudieron cargar los commits del archivo JSON.<br>
                        Posibles causas:
                    </p>
                    <ul style="margin-left: 20px; margin-top: 10px;">
                        <li>El archivo está vacío o corrupto</li>
                        <li>Formato JSON inválido</li>
                        <li>Caracteres especiales no escapados</li>
                    </ul>
                    <div style="margin-top: 20px;">
                        <button onclick="tryDebugMode()" 
                            style="padding: 10px 20px; background: #667eea; color: white; 
                                   border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                            Modo Depuración
                        </button>
                        <button onclick="location.reload()" 
                            style="padding: 10px 20px; background: #f0f4f8; color: #333; 
                                   border: none; border-radius: 5px; cursor: pointer;">
                            Reintentar
                        </button>
                    </div>
                </li>
            `;
        });
    
    // Función para limpiar JSON
    function cleanJSON(jsonText) {
        let result = jsonText;
        
        // 1. Eliminar BOM
        result = result.replace(/^\uFEFF/, '');
        
        // 2. Eliminar caracteres de control (excepto tab, newline, carriage return)
        result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        
        // 3. Arreglar escapes comunes
        result = result.replace(/\\[^"\\\/bfnrtu]/g, '');
        
        // 4. Asegurar que las cadenas estén correctamente cerradas
        let inString = false;
        let cleaned = '';
        
        for (let i = 0; i < result.length; i++) {
            const char = result[i];
            
            if (!inString) {
                cleaned += char;
                if (char === '"') inString = true;
            } else {
                if (result[i-1] !== '\\' && char === '"') {
                    cleaned += char;
                    inString = false;
                } else {
                    cleaned += char;
                }
            }
        }
        
        return cleaned;
    }
    
    // Función para extraer objetos JSON manualmente
    function extractJSONObjects(text) {
        const objects = [];
        let depth = 0;
        let inString = false;
        let currentObject = '';
        let escapeNext = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (escapeNext) {
                escapeNext = false;
                currentObject += char;
                continue;
            }
            
            if (char === '\\' && inString) {
                escapeNext = true;
                currentObject += char;
                continue;
            }
            
            if (char === '"' && !escapeNext) {
                inString = !inString;
            }
            
            if (!inString) {
                if (char === '{') {
                    if (depth === 0) {
                        currentObject = '';
                    }
                    depth++;
                }
                
                if (depth > 0) {
                    currentObject += char;
                }
                
                if (char === '}') {
                    depth--;
                    if (depth === 0 && currentObject.trim()) {
                        try {
                            const obj = JSON.parse(currentObject);
                            objects.push(obj);
                        } catch (e) {
                            // Ignorar objetos inválidos
                        }
                    }
                }
            } else if (depth > 0) {
                currentObject += char;
            }
        }
        
        return objects;
    }
    
    // Función para mostrar commits
    function displayCommits(data, container) {
        container.innerHTML = '';
        
        if (!Array.isArray(data)) {
            container.innerHTML = `
                <li style="background: #fff3e0; color: #ef6c00; padding: 20px; border-radius: 10px; margin: 20px;">
                    <h3>⚠️ Datos en formato incorrecto</h3>
                    <p>Se recibió: ${typeof data} en lugar de un array</p>
                    <p>Primeros 500 caracteres:</p>
                    <pre style="background: #fff; padding: 10px; border-radius: 5px; overflow: auto; max-height: 200px;">
${JSON.stringify(data, null, 2).substring(0, 500)}
                    </pre>
                </li>
            `;
            return;
        }
        
        if (data.length === 0) {
            container.innerHTML = `
                <li style="text-align: center; color: white; padding: 40px;">
                    <div style="font-size: 1.2em; margin-bottom: 10px;">📭 No hay commits disponibles</div>
                    <div style="color: rgba(255,255,255,0.8);">
                        El archivo JSON no contiene commits o está vacío
                    </div>
                </li>
            `;
            return;
        }
        
        console.log(`Mostrando ${data.length} commits`);
        
        // Ordenar por fecha (más reciente primero)
        const sortedCommits = [...data].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
        
        // Limitar para mejor rendimiento
        const commitsToShow = sortedCommits.slice(0, 100);
        
        commitsToShow.forEach((commit, index) => {
            const li = document.createElement('li');
            li.className = 'commit-item';
            li.style.cssText = `
                background: white;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 15px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border-left: 4px solid #667eea;
                transition: transform 0.2s ease;
            `;
            li.onmouseover = () => li.style.transform = 'translateY(-2px)';
            li.onmouseout = () => li.style.transform = 'translateY(0)';
            
            // Cabecera
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                align-items: flex-start;
                margin-bottom: 15px;
            `;
            
            const icon = document.createElement('div');
            icon.textContent = index + 1;
            icon.style.cssText = `
                background: #667eea;
                color: white;
                width: 35px;
                height: 35px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 15px;
                font-weight: bold;
                font-size: 0.9em;
                flex-shrink: 0;
            `;
            
            const message = document.createElement('div');
            message.style.cssText = 'flex: 1;';
            message.innerHTML = `
                <div style="font-size: 1.1em; font-weight: bold; color: #333; margin-bottom: 5px; line-height: 1.4;">
                    ${escapeHTML(commit.message || commit.commit || 'Sin mensaje')}
                </div>
                <div style="font-size: 0.85em; color: #666;">
                    <span style="color: #667eea; font-weight: bold;">${escapeHTML(commit.author || 'Desconocido')}</span>
                    <span style="margin: 0 8px;">•</span>
                    <span>${escapeHTML(commit.date || 'Sin fecha')}</span>
                </div>
            `;
            
            header.appendChild(icon);
            header.appendChild(message);
            
            // Archivos
            const files = Array.isArray(commit.files) ? commit.files : [];
            
            if (files.length > 0) {
                const filesBtn = document.createElement('button');
                filesBtn.textContent = `📁 ${files.length} archivo${files.length !== 1 ? 's' : ''}`;
                filesBtn.style.cssText = `
                    background: #f0f4f8;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 0.9em;
                    color: #667eea;
                    transition: background 0.2s;
                    margin-top: 10px;
                `;
                filesBtn.onmouseover = () => filesBtn.style.background = '#e1e8f0';
                filesBtn.onmouseout = () => filesBtn.style.background = '#f0f4f8';
                
                const filesList = document.createElement('div');
                filesList.style.cssText = `
                    display: none;
                    margin-top: 15px;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                    max-height: 200px;
                    overflow-y: auto;
                `;
                
                // Mostrar máximo 20 archivos
                const filesToShow = files.slice(0, 20);
                filesList.innerHTML = filesToShow.map(file => `
                    <div style="padding: 6px 0; border-bottom: 1px solid #eee; font-family: 'Courier New', monospace; font-size: 0.85em; word-break: break-all;">
                        📄 ${escapeHTML(file)}
                    </div>
                `).join('');
                
                if (files.length > 20) {
                    filesList.innerHTML += `
                        <div style="padding: 10px; text-align: center; color: #666; font-style: italic;">
                            ... y ${files.length - 20} archivos más
                        </div>
                    `;
                }
                
                filesBtn.onclick = () => {
                    const isVisible = filesList.style.display === 'block';
                    filesList.style.display = isVisible ? 'none' : 'block';
                    filesBtn.textContent = `📁 ${isVisible ? 'Mostrar' : 'Ocultar'} archivos (${files.length})`;
                };
                
                li.appendChild(header);
                li.appendChild(filesBtn);
                li.appendChild(filesList);
            } else {
                li.innerHTML = `
                    <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
                        <div style="background: #667eea; color: white; width: 35px; height: 35px; border-radius: 50%; 
                                    display: flex; align-items: center; justify-content: center; margin-right: 15px; 
                                    font-weight: bold; font-size: 0.9em; flex-shrink: 0;">
                            ${index + 1}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 1.1em; font-weight: bold; color: #333; margin-bottom: 5px; line-height: 1.4;">
                                ${escapeHTML(commit.message || commit.commit || 'Sin mensaje')}
                            </div>
                            <div style="font-size: 0.85em; color: #666;">
                                <span style="color: #667eea; font-weight: bold;">${escapeHTML(commit.author || 'Desconocido')}</span>
                                <span style="margin: 0 8px;">•</span>
                                <span>${escapeHTML(commit.date || 'Sin fecha')}</span>
                            </div>
                        </div>
                    </div>
                    <div style="color: #888; font-style: italic; font-size: 0.9em; padding: 5px 0;">
                        Sin archivos modificados
                    </div>
                `;
            }
            
            container.appendChild(li);
        });
        
        // Agregar contador
        const counter = document.createElement('div');
        counter.style.cssText = `
            text-align: center;
            color: white;
            margin: 20px 0;
            font-size: 0.9em;
            opacity: 0.8;
        `;
        counter.textContent = `Mostrando ${commitsToShow.length} de ${data.length} commits totales`;
        container.parentNode.insertBefore(counter, container.nextSibling);
    }
    
    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

// Modo depuración
window.tryDebugMode = async function() {
    try {
        const response = await fetch('commits.json');
        const text = await response.text();
        
        console.log('=== DEBUG INFO ===');
        console.log('Tamaño total:', text.length);
        console.log('Primeros 500 caracteres:', text.substring(0, 500));
        console.log('Últimos 500 caracteres:', text.substring(text.length - 500));
        
        // Contar objetos
        const objects = text.match(/\{"commit"/g);
        console.log('Número de objetos "commit" encontrados:', objects ? objects.length : 0);
        
        // Mostrar en pantalla
        const container = document.getElementById('changelog');
        container.innerHTML = `
            <li style="background: #fff; color: #333; padding: 20px; border-radius: 10px; margin: 20px;">
                <h3>📊 Información de Depuración</h3>
                <p><strong>Tamaño del archivo:</strong> ${text.length} caracteres</p>
                <p><strong>Objetos "commit" encontrados:</strong> ${objects ? objects.length : 0}</p>
                
                <div style="margin-top: 20px;">
                    <h4>Primeras líneas:</h4>
                    <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; max-height: 200px;">
${text.substring(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                    </pre>
                </div>
                
                <button onclick="downloadRawJSON()" 
                    style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; 
                           border: none; border-radius: 5px; cursor: pointer;">
                    Descargar JSON original
                </button>
            </li>
        `;
        
    } catch (error) {
        alert('Error en modo depuración: ' + error.message);
    }
};

// Descargar JSON original
window.downloadRawJSON = async function() {
    try {
        const response = await fetch('commits.json');
        const text = await response.text();
        
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'commits_original.json';
        a.click();
        
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error al descargar: ' + error.message);
    }
};