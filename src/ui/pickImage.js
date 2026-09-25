/**
 * Ask for an image file and hand back a data URL.
 *
 * A data URL rather than an object URL on purpose: the result is kept in the
 * store and handed to a texture loader that may run later, and an object URL
 * is a pointer into a blob that any revoke or reload invalidates. A data URL
 * costs memory and is self-contained, which is the right trade for a logo.
 */
export function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })
}
