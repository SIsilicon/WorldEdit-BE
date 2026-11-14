
meowwwww :3

#grid

- ";set #grid3(red_wool,blue_wool)" 
- ";set #grid3:10(red_wool,blue_wool)" 
- ";set #grid3:3:3(red_wool,blue_wool)" 

**Parameters:** size size size

#triangle

- ";set #triangle8(red_wool,blue_wool)" 
- ";set #triangle16(yellow_wool,orange_wool,red_wool)" 

**Parameters:** size

#hexagon

- ";set #hexagon8(yellow_wool,orange_wool,brown_wool)" 
- ";set #hexagon12(red_wool,blue_wool)" 

**Parameters:** size

#brick

- ";set #brick8:4:1(red_wool,black_concrete)"
- ";set #brick12:6:1(red_wool,orange_wool,black_concrete)"

**Parameters:** width height mortar thickness. Last material = mortar; earlier materials = bricks. 2D X/Z, rows staggered.

#dots

- ";set #dots8:2(red_wool,blue_wool)"
- ";set #dots12:4(red_wool,yellow_wool,black_wool)"

**Parameters:** spacing dot radius. Last material = background. 2D X/Z.

#rings

- ";set #rings12:2(red_wool,blue_wool)"
- ";set #rings16:3(red_wool,orange_wool,black_wool)"

**Parameters:** ring spacing thickness. Last material = background. 2D concentric rings centered on the selection (so they re-center in a new selection).

#bubbles

- ";set #bubbles10:2:2:0.6(white_wool,light_blue_wool,blue_wool)"
- ";set #bubbles8:2:2:0.9(white_wool,blue_wool)"

**Parameters:** average radius, variation (+/-), edge thickness, concentration (0 to 1 = chance per cell). With 3 materials: inside, rim, background. With 2: hollow rim, background. Bubbles do not overlap. 2D X/Z.

#voronoi

- ";set #voronoi10(red_wool,blue_wool,yellow_wool)"
- ";set #voronoi16:0.5(stone,andesite,granite)"

**Parameters:** cell size, jitter (0 to 1; default 0.8). Randomized irregular polygon cells. 2D X/Z.

#blob

- ";set #blob10(red_wool,blue_wool)" 

**Parameters:** size

#perlin

- ";set #perlin12(red_wool,blue_wool)" 
- ";set #perlin6(red_wool,blue_wool,white_wool)" 

**Parameters:** size

#cracked

- ";set #cracked12(red_wool,blue_wool)" 
- ";set #cracked12:2(stone,black_concrete)" 

**Parameters:** size thickness

#wood

- ";set #wood12(brown_wool,orange_wool)"
- ";set #wood12:6(brown_wool,orange_wool)" 

**Parameters:** size bands

#turbulence

- ";set #turbulence12(red_wool,blue_wool)" 
- ";set #turbulence12:4:0.5:2(red_wool,blue_wool)" 

**Parameters:** size octaves persistence lacunarity

#marble

- ";set #marble12(white_wool,gray_wool)" 
- ";set #marble12:2:8(white_wool,gray_wool)" 

**Parameters:** " size bands distortion octaves persistence lacunarity

#fbm

- ";set #fbm12(red_wool,blue_wool)" 
- ";set #fbm12:5(red_wool,blue_wool)" 

**Parameters:** size octaves persistence lacunarity

#veins

- ";set #veins12(stone,diamond_block)" 
- ";set #veins12:0.2(stone,diamond_block)" 

**Parameters:**  size width

#warped

- ";set #warped12(red_wool,blue_wool)" 
- ";set #warped12:2(red_wool,blue_wool)"

**Parameters:**  size strength

#simplex

- ";set #simplex12(red_wool,blue_wool)" 

**Parameters:** size

#value

- ";set #value12(red_wool,blue_wool)"

**Parameters:** size

#pingpong

- ";set #pingpong12(red_wool,blue_wool)"
- ";set #pingpong12:2:4(red_wool,blue_wool)"

**Parameters:**  size strength octaves persistence lacunarity
