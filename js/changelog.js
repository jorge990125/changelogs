document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('changelog');
    if (!container) return;
    
    // Mostrar carga
    container.innerHTML = '<li style="color: white; padding: 20px; text-align: center;">⏳ Cargando cambios...</li>';
    
    fetch('commits.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            // Obtener como texto primero
            return response.text();
        })
        .then(text => {
            console.log('Tamaño del JSON:', text.length, 'caracteres');
            
            // Función para limpiar el JSON de forma segura
            function cleanJSON(jsonText) {
                // Reemplazar secuencias de escape inválidas
                let cleaned = jsonText;
                
                // 1. Escapar correctamente las comillas dentro de las rutas
                cleaned = cleaned.replace(/\\[^"\\\/bfnrtu]/g, '');
                
                // 2. Reemplazar caracteres de control
                cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
                
                // 3. Asegurar que las comillas estén cerradas
                cleaned = cleaned.replace(/([^\\])"(?=[^"])/g, '$1\\"');
                
                // 4. Manejar el array gigante de archivos (especial para tu caso)
                // Buscar arrays muy largos y dividirlos
                const longArrayRegex = /"files":\s*\[(.*?)\]/gs;
                cleaned = cleaned.replace(longArrayRegex, (match, arrayContent) => {
                    // Si el contenido del array es muy largo, procesarlo
                    if (arrayContent.length > 10000) {
                        // Dividir por comas y limpiar cada elemento
                        const items = arrayContent.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
                        const cleanedItems = items.map(item => {
                            // Limpiar cada item individualmente
                            let cleanItem = item.trim();
                            // Quitar comillas exteriores si existen
                            cleanItem = cleanItem.replace(/^"(.*)"$/, '$1');
                            // Escapar comillas internas
                            cleanItem = cleanItem.replace(/"/g, '\\"');
                            // Asegurar que esté entre comillas
                            return `"${cleanItem}"`;
                        });
                        return `"files": [${cleanedItems.join(',')}]`;
                    }
                    return match;
                });
                
                return cleaned;
            }
            
            try {
                // Limpiar el JSON
                const cleanedText = cleanJSON(text);
                
                // Parsear
                const data = JSON.parse(cleanedText);
                console.log('✅ JSON parseado exitosamente:', data.length, 'commits');
                
                // Mostrar los commits
                displayCommits(data, container);
                
            } catch (parseError) {
                console.error('Error al parsear JSON:', parseError);
                
                // Método alternativo: extraer solo la estructura básica
                try {
                    console.log('Intentando método alternativo...');
                    
                    // Buscar patrones de objetos JSON
                    const jsonObjects = text.match(/\{"commit".*?\}(?=,\s*\{)/gs) || [];
                    const fixedJson = `[${jsonObjects.join(',')}]`;
                    
                    const data = JSON.parse(fixedJson);
                    console.log('✅ Método alternativo exitoso:', data.length, 'commits');
                    displayCommits(data, container);
                    
                } catch (altError) {
                    // Mostrar error detallado
                    container.innerHTML = `
                        <li style="background: #ffebee; color: #c62828; padding: 30px; border-radius: 10px; margin: 20px;">
                            <h3>❌ Error crítico en el archivo JSON</h3>
                            <p><strong>${parseError.message}</strong></p>
                            <p style="margin-top: 15px;">
                                El archivo commits.json tiene un formato inválido.<br>
                                <strong>Problema:</strong> Array de archivos demasiado largo con caracteres mal escapados.
                            </p>
                            <div style="margin-top: 20px; padding: 15px; background: #fff; border-radius: 5px; font-family: monospace; font-size: 0.9em; overflow: auto; max-height: 200px;">
                                ${text.substring(155800, 155900).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                            </div>
                            <p style="margin-top: 15px; font-size: 0.9em;">
                                <strong>Sugerencia:</strong> Regenera el archivo JSON con rutas más cortas o divide el commit en múltiples commits.
                            </p>
                        </li>
                    `;
                }
            }
        })
        .catch(error => {
            console.error('Error de red:', error);
            container.innerHTML = `
                <li style="background: #fff3e0; color: #ef6c00; padding: 20px; border-radius: 10px; margin: 20px;">
                    <h3>⚠️ Error de conexión</h3>
                    <p>No se pudo cargar el archivo commits.json: ${error.message}</p>
                </li>
            `;
        });
    
    function displayCommits(data, container) {
        container.innerHTML = '';
        
        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<li style="color: white; padding: 20px; text-align: center;">📭 No hay commits disponibles</li>';
            return;
        }
        
        // Ordenar del más reciente al más antiguo
        const commits = [...data].reverse();
        
        // Limitar a 50 commits para mejor rendimiento
        const commitsToShow = commits.slice(0, 50);
        
        commitsToShow.forEach((commit, index) => {
            const li = document.createElement('li');
            li.style.cssText = `
                margin-bottom: 15px;
                padding: 20px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border-left: 5px solid #667eea;
            `;
            
            // Cabecera
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                align-items: flex-start;
                margin-bottom: 15px;
            `;
            
            const icon = document.createElement('span');
            icon.textContent = '✓';
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
                flex-shrink: 0;
            `;
            
            const msg = document.createElement('div');
            msg.innerHTML = `
                <div style="font-size: 1.2em; font-weight: bold; color: #333; margin-bottom: 5px;">
                    ${escapeHTML(commit.message || 'Sin mensaje')}
                </div>
                <div style="font-size: 0.9em; color: #666;">
                    <span style="color: #667eea; font-weight: bold;">${escapeHTML(commit.author || 'Desconocido')}</span>
                    • ${escapeHTML(commit.date || 'Sin fecha')}
                </div>
            `;
            
            header.appendChild(icon);
            header.appendChild(msg);
            
            // Archivos (mostrar solo contador, no todos los archivos)
            const files = Array.isArray(commit.files) ? commit.files : [];
            
            let filesContent = '';
            if (files.length > 0) {
                if (files.length <= 10) {
                    // Mostrar pocos archivos
                    filesContent = files.map(f => `
                        <div style="padding: 5px 0; border-bottom: 1px solid #eee; font-family: monospace; font-size: 0.9em;">
                            📄 ${escapeHTML(f)}
                        </div>
                    `).join('');
                } else {
                    // Mostrar solo los primeros 5 y contador
                    filesContent = `
                        ${files.slice(0, 5).map(f => `
                            <div style="padding: 5px 0; border-bottom: 1px solid #eee; font-family: monospace; font-size: 0.9em;">
                                📄 ${escapeHTML(f)}
                            </div>
                        `).join('')}
                        <div style="padding: 10px; text-align: center; color: #666; font-style: italic;">
                            ... y ${files.length - 5} archivos más
                        </div>
                    `;
                }
            } else {
                filesContent = '<div style="padding: 10px; text-align: center; color: #888; font-style: italic;">No hay archivos modificados</div>';
            }
            
            // Toggle para archivos
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = `📁 ${files.length > 0 ? `Ver archivos (${files.length})` : 'Sin archivos'}`;
            toggleBtn.style.cssText = `
                background: #f0f4f8;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 0.9em;
                color: #667eea;
                margin-top: 10px;
                transition: all 0.2s;
            `;
            toggleBtn.onmouseover = () => toggleBtn.style.background = '#e1e8f0';
            toggleBtn.onmouseout = () => toggleBtn.style.background = '#f0f4f8';
            
            const filesDiv = document.createElement('div');
            filesDiv.style.cssText = `
                display: none;
                margin-top: 15px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e9ecef;
                max-height: 300px;
                overflow-y: auto;
            `;
            filesDiv.innerHTML = filesContent;
            
            toggleBtn.onclick = () => {
                const isVisible = filesDiv.style.display === 'block';
                filesDiv.style.display = isVisible ? 'none' : 'block';
                toggleBtn.textContent = `📁 ${isVisible ? 'Mostrar' : 'Ocultar'} archivos (${files.length})`;
            };
            
            li.appendChild(header);
            li.appendChild(toggleBtn);
            li.appendChild(filesDiv);
            container.appendChild(li);
        });
        
        console.log(`Mostrando ${commitsToShow.length} commits`);
    }
    
    function escapeHTML(text) {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});