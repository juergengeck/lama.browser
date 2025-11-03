// Run this in browser console to check ALL storage locations
async function checkAllStorage() {
  console.log('=== CHECKING ALL STORAGE ===')

  // 1. IndexedDB
  console.log('\n1. IndexedDB Databases:')
  try {
    const dbs = await indexedDB.databases()
    console.log(`Found ${dbs.length} databases:`, dbs)
    for (const db of dbs) {
      console.log(`  - ${db.name} (version ${db.version})`)
    }
  } catch (e) {
    console.error('Error listing IndexedDB:', e)
  }

  // 2. localStorage
  console.log('\n2. localStorage:')
  console.log(`Items: ${localStorage.length}`)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    const value = localStorage.getItem(key)
    console.log(`  - ${key}: ${value ? value.substring(0, 50) : ''}...`)
  }

  // 3. sessionStorage
  console.log('\n3. sessionStorage:')
  console.log(`Items: ${sessionStorage.length}`)
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    const value = sessionStorage.getItem(key)
    console.log(`  - ${key}: ${value ? value.substring(0, 50) : ''}...`)
  }

  // 4. Cache Storage
  console.log('\n4. Cache Storage:')
  try {
    const cacheNames = await caches.keys()
    console.log(`Found ${cacheNames.length} caches:`, cacheNames)
  } catch (e) {
    console.error('Error listing caches:', e)
  }

  // 5. Cookies
  console.log('\n5. Cookies:')
  console.log(document.cookie || '(none)')

  console.log('\n=== DONE ===')
}

checkAllStorage()
