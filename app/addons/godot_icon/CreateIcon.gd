extends SceneTree

var error_handler: Object
var error_callback: String


func _init() -> void:
	var arguments = OS.get_cmdline_args()
	if arguments.size() != 4 and arguments.size() != 9:
		print(
			"Usage:\n  godot -s CreateIcon.gd name <file>...\n",
			"\n",
			"Creates uncompressed windows ico file.\n",
			"Add --no-window to hide Godot console.\n",
			"\n",
			"Arguments:\n",
			"  godot  path to Godot 3.x executable\n",
			"  name   path to created icon\n",
			"  <file> provide one or six files. If one provided it will be scaled for all\n",
			"         icon resolutions. Multiple files should be 16x16, 32x32, 48x48, 64x64,\n",
			"         128x128\n and 256x256 pixels big."
		)
		quit()
		return
	var images := []
	if arguments.size() == 9:
		var names := [arguments[3], arguments[4], arguments[5], arguments[6], arguments[7], arguments[8]]
		var check_names := {}
		for name in names:
			if check_names.has(name):
				print_error(str("File ", name, " was added more than once"))
				return
			check_names[name] = true
		images = load_images(names)
	else:
		images = prepare_images(arguments[3])
	if not images.empty():
		save_icon(arguments[2], images)
	quit()


func load_images(paths: Array) -> Array:
	var images := []
	for path in paths:
		var image := Image.new()
		var error = image.load(path)
		if error:
			print_error(str("Could not load image: ", path))
			return []
		image.convert(Image.FORMAT_RGBA8)
		images.append(image)
	images.sort_custom(self, "sort_images_by_size")
	var index := 0
	for size in [16, 32, 48, 64, 128, 256]:
		var image: Image = images[index]
		if image.get_width() != size:
			print_error(str("Image has incorrect width: ", image.get_width(), " expected: ", size))
			return []
		if image.get_height() != size:
			print_error(str("Image has incorrect height: ", image.get_height(), " expected: ", size))
			return []
		index += 1
	return images


func prepare_images(path: String) -> Array:
	var images := []
	for size in [16, 32, 48, 64, 128, 256]:
		var image := Image.new()
		var error = image.load(path)
		if error:
			print_error(str("Could not load image: ", path))
			return []
		image.convert(Image.FORMAT_RGBA8)
		image.resize(size, size)
		images.append(image)
	return images


func save_icon(destination_path: String, images: Array) -> void:
	var file = File.new()
	var error = file.open(destination_path, File.WRITE)
	if error:
		print_error(str("Could not open ", destination_path, " for writing!"))
		return
	var icon_creator := IconCreator.new()
	file.store_buffer(icon_creator.generate_icon(images))
	file.close()


func print_error(error_message: String) -> void:
	printerr(error_message)
	if error_handler and error_callback:
		error_handler.call(error_callback, error_message)


static func sort_images_by_size(a: Image, b: Image) -> bool:
	return a.get_width() < b.get_width()


class IconCreator:
	const PNG_SIGNATURE := PoolByteArray([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0a])
	const IHDR_SIGNATURE := PoolByteArray([0x49, 0x48, 0x44, 0x52])
	const IDAT_SIGNATURE := PoolByteArray([0x49, 0x44, 0x41, 0x54])
	const IEND_SIGNATURE := PoolByteArray([0x49, 0x45, 0x4e, 0x44])
	const ADLER_MOD := 65521
	const ZLIB_BLOCK_SIZE := 16384
	const CRC_TABLE_SIZE := 256
	const ICON_ENTRY_SIZE := 16

	var crc_table: Array


	func _init() -> void:
		crc_table = generate_crc_table()


	func generate_icon(images: Array) -> PoolByteArray:
		var result := PoolByteArray()
		result.append_array(generate_icon_header(images.size()))
		var offset := result.size() + images.size() * ICON_ENTRY_SIZE
		var pngs := []
		for image in images:
			assert(image.get_format() == Image.FORMAT_RGBA8)
			var png := generate_png(image)
			pngs.append(png)
			var icon_entry := generate_icon_entry(image, png.size(), offset)
			result.append_array(icon_entry)
			offset += png.size()
		for png in pngs:
			result.append_array(png)
		return result


	func generate_icon_header(size: int) -> PoolByteArray:
		var result := PoolByteArray()
		result.append_array(lsb_first(0x0, 2)) # reserved
		result.append_array(lsb_first(0x1, 2)) # icon type
		result.append_array(lsb_first(size, 2)) # image count
		return result


	func generate_icon_entry(image: Image, size: int, offset: int) -> PoolByteArray:
		var result := PoolByteArray()
		result.append(image.get_width()) # width
		result.append(image.get_height()) # height
		result.append(0x0) # size of color palette
		result.append(0x0) # reserved
		result.append_array(lsb_first(0, 2)) # no color planes
		result.append_array(lsb_first(32, 2)) # bits per pixel
		result.append_array(lsb_first(size)) # size of embedded png
		result.append_array(lsb_first(offset))
		return result


	func generate_png(image: Image) -> PoolByteArray:
		var result := PoolByteArray()
		var header_chunk := generate_header_chunk(image.get_width(), image.get_height())
		var data_chunk := generate_data_chunk(image)
		var end_chunk := generate_end_chunk()
		result.append_array(PNG_SIGNATURE)
		result.append_array(generate_chunk(header_chunk))
		result.append_array(generate_chunk(data_chunk))
		result.append_array(generate_chunk(end_chunk))
		return result


	func generate_chunk(chunk: PoolByteArray) -> PoolByteArray:
		var result := PoolByteArray()
		result.append_array(msb_first(chunk.size() - 4))
		result.append_array(chunk)
		result.append_array(msb_first(crc(chunk)))
		return result


	func generate_header_chunk(width: int, height: int) -> PoolByteArray:
		var result = PoolByteArray()
		result.append_array(IHDR_SIGNATURE)
		result.append_array(msb_first(width))
		result.append_array(msb_first(height))
		result.append(0x8) # bit depth
		result.append(0x6) # color type 32bit RGBA
		result.append(0x0) # compression method
		result.append(0x0) # filter method
		result.append(0x0) # interlace method
		return result


	func generate_data_chunk(image: Image) -> PoolByteArray:
		var filtered_pixels := filtered_pixels(image.get_width(), image.get_height(), image.get_data())
		var zlib_block_count := filtered_pixels.size() / ZLIB_BLOCK_SIZE + (1 if filtered_pixels.size() % ZLIB_BLOCK_SIZE else 0)
		var result := PoolByteArray()
		result.append_array(IDAT_SIGNATURE)
		result.append(0x78) # CMF
		result.append(0x1) # FLG
		for i in range(zlib_block_count):
			var last_block := i == zlib_block_count - 1
			result.append(0x1 if last_block else 0x0)
			var block_size := filtered_pixels.size() % ZLIB_BLOCK_SIZE if last_block else ZLIB_BLOCK_SIZE
			result.append_array(block_size(block_size))
			for b in range(block_size):
				result.append(filtered_pixels[i * ZLIB_BLOCK_SIZE + b])
		result.append_array(msb_first(adler(filtered_pixels)))
		return result


	func generate_end_chunk() -> PoolByteArray:
		return IEND_SIGNATURE


	func filtered_pixels(width: int, height: int, pixels: PoolByteArray) -> PoolByteArray:
		var result = PoolByteArray()
		for row in range(height):
			result.append(0x0)
			for column in range(width * 4):
				result.append(pixels[row * width * 4 + column])
		return result


	func generate_crc_table() -> Array:
		var result = []
		var c: int
		for n in range(CRC_TABLE_SIZE):
			c = n
			for _i in range(8):
				if (c & 1) != 0:
					c = 0xedb88320 ^ (c >> 1)
				else:
					c = c >> 1
			result.append(c)
		return result


	func crc(bytes: PoolByteArray) -> int:
		var c := 0xffffffff
		for i in range(bytes.size()):
			c = crc_table[(c ^ bytes[i]) & 0xff] ^ (c >> 8)
		return c ^ 0xffffffff


	func adler(bytes: PoolByteArray) -> int:
		var a := 1
		var b := 0
		for byte in bytes:
			a = (a + byte) % ADLER_MOD
			b = (a + b) % ADLER_MOD
		return b << 16 | a


	func msb_first(i: int) -> PoolByteArray:
		var result := PoolByteArray()
		result.append((i >> 24) & 0xff)
		result.append((i >> 16) & 0xff)
		result.append((i >> 8) & 0xff)
		result.append(i & 0xff)
		return result


	func lsb_first(i: int, size = 4) -> PoolByteArray:
		var result := PoolByteArray()
		for _s in range(size):
			result.append(i & 0xff)
			i = i >> 8
		return result


	func block_size(i: int) -> PoolByteArray:
		var result := PoolByteArray()
		result.append(i & 0xff)
		result.append((i >> 8) & 0xff)
		result.append((i & 0xff) ^ 0xff)
		result.append(((i >> 8) & 0xff) ^ 0xff)
		return result
