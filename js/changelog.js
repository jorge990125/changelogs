fetch('commits.json')
  .then(res => {
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
    }
    
    // Primero obtener como texto para limpiar si es necesario
    return res.text();
  })
  .then(text => {
    console.log('JSON recibido, tamaño:', text.length, 'caracteres');
    
    let data;
    
    try {
      // Intentar parsear directamente
      data = JSON.parse(text);
      console.log('✅ JSON parseado directamente');
    } catch (parseError) {
      console.log('Parseo directo falló, limpiando JSON...');
      
      // Limpiar el JSON
      const cleanedText = cleanJSON(text);
      
      try {
        data = JSON.parse(cleanedText);
        console.log('✅ JSON limpiado exitosamente');
      } catch (cleanError) {
        console.error('Error después de limpiar:', cleanError);
        
        // Método alternativo: extraer objetos manualmente
        data = extractJSONObjects(text);
        console.log(`✅ Extraídos ${data.length} commits manualmente`);
      }
    }
    
    if (!data || data.length === 0) {
      const container = document.getElementById('changelog');
      container.innerHTML = '<li style="color: white; text-align: center; padding: 20px;">📭 No hay commits disponibles</li>';
      return;
    }
    
    // Continuar con tu código original
    displayCommits(data);
  })
  .catch(err => {
    console.error('Error cargando commits.json:', err);
    
    const container = document.getElementById('changelog');
    container.innerHTML = `
      <li style="background: #ffebee; color: #c62828; padding: 20px; border-radius: 10px; margin: 10px;">
        <h3 style="margin-bottom: 10px;">❌ Error al cargar commits</h3>
        <p><strong>${err.message}</strong></p>
        <p>Verifica que el archivo commits.json exista y sea accesible.</p>
      </li>
    `;
  });

// Función para limpiar JSON
function cleanJSON(jsonText) {
  let cleaned = jsonText;
  
  // 1. Eliminar BOM si existe
  cleaned = cleaned.replace(/^\uFEFF/, '');
  
  // 2. Eliminar caracteres de control problemáticos
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  // 3. Arreglar escapes incorrectos
  cleaned = cleaned.replace(/\\[^"\\\/bfnrtu]/g, '');
  
  // 4. Reemplazar caracteres Unicode problemáticos
  cleaned = cleaned.replace(/[^\x00-\x7F]/g, function(char) {
    return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
  });
  
  // 5. Asegurar que las comillas estén cerradas
  let inString = false;
  let result = '';
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    
    if (char === '"' && (i === 0 || cleaned[i-1] !== '\\')) {
      inString = !inString;
    }
    
    result += char;
  }
  
  return result;
}

// Función para extraer objetos JSON manualmente
function extractJSONObjects(text) {
  const objects = [];
  let currentObject = '';
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (escapeNext) {
      escapeNext = false;
      currentObject += char;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
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
            // Asegurar que sea un objeto JSON válido
            const fixedObject = currentObject
              .replace(/,(\s*[\]}])/g, '$1') // Eliminar comas extra
              .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // Añadir comillas a keys
            
            const obj = JSON.parse(fixedObject);
            if (obj.commit || obj.message || obj.author) {
              objects.push(obj);
            }
          } catch (e) {
            // Ignorar objetos inválidos
            console.log('Objeto inválido ignorado:', currentObject.substring(0, 100));
          }
        }
      }
    } else if (depth > 0) {
      currentObject += char;
    }
  }
  
  return objects;
}

// Tu función original de displayCommits
function displayCommits(data) {
  const container = document.getElementById('changelog');
  
  // Ordenamos del más reciente al más antiguo
  data.reverse().forEach(commit => {
    const li = document.createElement('li');

    // Cabecera del commit
    const header = document.createElement('div');
    header.className = 'commit-header';

    const icon = document.createElement('span');
    icon.className = 'commit-icon';

    const msg = document.createElement('span');
    msg.innerHTML = `<strong>${escapeHTML(commit.message || 'Sin mensaje')}</strong>✅<span class="azul">${escapeHTML(commit.author || 'Desconocido')}</span> (${escapeHTML(commit.date || 'Sin fecha')})`;

    header.appendChild(icon);
    header.appendChild(msg);

    // Toggle para mostrar archivos
    const toggle = document.createElement('span');
    toggle.className = 'toggle';
    toggle.textContent = 'Mostrar archivos';

    const filesDiv = document.createElement('div');
    filesDiv.className = 'files';
    filesDiv.style.display = 'none';

    // Asegurarse que files sea un array
    const files = Array.isArray(commit.files) ? commit.files : [];
    if(files.length > 0){
      filesDiv.innerHTML = files.map(f => `<div>${escapeHTML(f)}</div>`).join('');
    } else {
      filesDiv.innerHTML = '<div><em>No hay archivos modificados</em></div>';
    }

    toggle.onclick = () => {
      filesDiv.style.display = filesDiv.style.display === 'none' ? 'flex' : 'none';
      toggle.textContent = filesDiv.style.display === 'none' ? 'Mostrar archivos' : 'Ocultar archivos';
    };

    li.appendChild(header);
    li.appendChild(toggle);
    li.appendChild(filesDiv);

    container.appendChild(li);
  });
  
  console.log(`✅ Mostrados ${data.length} commits`);
}

// Función para escapar HTML (seguridad)
function escapeHTML(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}