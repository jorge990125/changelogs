// Primero, verificar si el elemento contenedor existe
const container = document.getElementById('changelog');
if (!container) {
    console.error('Error: No se encontró el elemento con id="changelog"');
} else {
    // Mostrar mensaje de carga
    container.innerHTML = '<li style="padding: 20px; text-align: center;">⏳ Cargando commits...</li>';
    
    // Función para limpiar el JSON de caracteres problemáticos
    function cleanJSON(jsonString) {
        return jsonString
            // Eliminar caracteres de control (excepto tab y newline)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
            // Arreglar escapes incorrectos
            .replace(/\\[^"\\\/bfnrtu]/g, '\\\\$&')
            // Reemplazar comillas simples no escapadas
            .replace(/(?<!\\)'/g, "\\'")
            // Asegurar que comillas dobles estén correctamente emparejadas
            .replace(/([^\\])""/g, '$1\\"\\"');
    }

    // Función para escapar HTML (seguridad)
    function escapeHTML(text) {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    fetch('commits.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Primero obtener como texto
            return response.text();
        })
        .then(text => {
            console.log('JSON recibido, tamaño:', text.length, 'caracteres');
            
            try {
                // Limpiar el JSON antes de parsear
                const cleanedText = cleanJSON(text);
                const data = JSON.parse(cleanedText);
                
                console.log('✅ JSON parseado correctamente. Commits:', data.length);
                
                // Limpiar el contenedor
                container.innerHTML = '';
                
                // Verificar si hay datos
                if (!Array.isArray(data) || data.length === 0) {
                    container.innerHTML = '<li style="padding: 20px; text-align: center;">📭 No hay commits disponibles</li>';
                    return;
                }
                
                // Ordenar del más reciente al más antiguo
                data.reverse().forEach((commit, index) => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '15px';
                    li.style.padding = '15px';
                    li.style.backgroundColor = '#fff';
                    li.style.borderRadius = '8px';
                    li.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    li.style.borderLeft = '4px solid #0366d6';

                    // Cabecera del commit
                    const header = document.createElement('div');
                    header.className = 'commit-header';
                    header.style.display = 'flex';
                    header.style.alignItems = 'center';
                    header.style.marginBottom = '10px';

                    const icon = document.createElement('span');
                    icon.className = 'commit-icon';
                    icon.textContent = '✓';
                    icon.style.backgroundColor = '#0366d6';
                    icon.style.color = 'white';
                    icon.style.width = '30px';
                    icon.style.height = '30px';
                    icon.style.borderRadius = '50%';
                    icon.style.display = 'flex';
                    icon.style.alignItems = 'center';
                    icon.style.justifyContent = 'center';
                    icon.style.marginRight = '12px';
                    icon.style.fontWeight = 'bold';

                    const msg = document.createElement('span');
                    msg.innerHTML = `
                        <strong style="font-size: 1.1em; color: #24292e;">${escapeHTML(commit.message || 'Sin mensaje')}</strong>
                        <span style="margin: 0 10px;">•</span>
                        <span class="azul" style="color: #0366d6; font-weight: bold;">${escapeHTML(commit.author || 'Desconocido')}</span>
                        <span style="margin: 0 10px;">•</span>
                        <span style="color: #586069; font-size: 0.9em;">${escapeHTML(commit.date || 'Sin fecha')}</span>
                    `;

                    header.appendChild(icon);
                    header.appendChild(msg);

                    // Toggle para mostrar archivos
                    const toggle = document.createElement('span');
                    toggle.className = 'toggle';
                    toggle.textContent = '📁 Mostrar archivos';
                    toggle.style.cursor = 'pointer';
                    toggle.style.color = '#0366d6';
                    toggle.style.fontSize = '0.9em';
                    toggle.style.padding = '5px 10px';
                    toggle.style.backgroundColor = '#f6f8fa';
                    toggle.style.borderRadius = '4px';
                    toggle.style.display = 'inline-block';
                    toggle.style.marginTop = '5px';

                    const filesDiv = document.createElement('div');
                    filesDiv.className = 'files';
                    filesDiv.style.display = 'none';
                    filesDiv.style.marginTop = '10px';
                    filesDiv.style.padding = '12px';
                    filesDiv.style.backgroundColor = '#fafbfc';
                    filesDiv.style.borderRadius = '6px';
                    filesDiv.style.border = '1px solid #e1e4e8';

                    // Asegurarse que files sea un array
                    const files = Array.isArray(commit.files) ? commit.files : [];
                    if (files.length > 0) {
                        filesDiv.innerHTML = files.map(f => 
                            `<div style="padding: 4px 0; font-family: 'Courier New', monospace; font-size: 0.9em;">
                                📄 ${escapeHTML(f)}
                            </div>`
                        ).join('');
                    } else {
                        filesDiv.innerHTML = '<div style="color: #6a737d; font-style: italic;">No hay archivos modificados</div>';
                    }

                    toggle.onclick = () => {
                        const isVisible = filesDiv.style.display === 'block';
                        filesDiv.style.display = isVisible ? 'none' : 'block';
                        toggle.textContent = isVisible ? '📁 Mostrar archivos' : '📂 Ocultar archivos';
                    };

                    li.appendChild(header);
                    li.appendChild(toggle);
                    li.appendChild(filesDiv);

                    container.appendChild(li);
                });
                
                console.log(`✅ ${data.length} commits mostrados correctamente`);
                
            } catch (parseError) {
                console.error('❌ Error al parsear JSON:', parseError);
                
                // Mostrar error específico
                const errorMatch = parseError.message.match(/line (\d+) column (\d+)/);
                if (errorMatch) {
                    const lineNum = errorMatch[1];
                    const colNum = errorMatch[2];
                    
                    // Intentar extraer la línea problemática
                    const lines = text.split('\n');
                    const problemLine = lines[lineNum - 1];
                    
                    container.innerHTML = `
                        <li style="background: #ffebee; color: #c62828; padding: 20px; border-radius: 8px; margin: 10px;">
                            <h3 style="margin-bottom: 10px;">❌ Error en el archivo JSON</h3>
                            <p><strong>Error:</strong> ${parseError.message}</p>
                            <p style="margin-top: 10px; font-size: 0.9em;">
                                <strong>Ubicación:</strong> Línea ${lineNum}, Columna ${colNum}<br>
                                <strong>Contenido problemático:</strong> ${escapeHTML(problemLine?.substring(colNum - 10, colNum + 10) || 'No disponible')}
                            </p>
                            <div style="margin-top: 15px; padding: 10px; background: #fff; border-radius: 4px; font-family: monospace; font-size: 0.9em;">
                                ${escapeHTML(problemLine || 'Línea no encontrada')}
                            </div>
                        </li>
                    `;
                } else {
                    container.innerHTML = `
                        <li style="background: #ffebee; color: #c62828; padding: 20px; border-radius: 8px; margin: 10px;">
                            <h3 style="margin-bottom: 10px;">❌ Error al procesar el archivo JSON</h3>
                            <p><strong>Error:</strong> ${parseError.message}</p>
                            <p>Verifica que el archivo commits.json tenga un formato JSON válido.</p>
                        </li>
                    `;
                }
            }
        })
        .catch(error => {
            console.error('Error en la solicitud:', error);
            
            container.innerHTML = `
                <li style="background: #fff3e0; color: #ef6c00; padding: 20px; border-radius: 8px; margin: 10px;">
                    <h3 style="margin-bottom: 10px;">⚠️ Error de conexión</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>No se pudo cargar el archivo commits.json. Verifica:</p>
                    <ul style="margin-left: 20px; margin-top: 10px;">
                        <li>Que el archivo exista en el servidor</li>
                        <li>Que tengas conexión a internet</li>
                        <li>Que la URL sea correcta</li>
                    </ul>
                </li>
            `;
        });
}