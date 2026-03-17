from google import genai
from google.genai import types
import os
import base64

client = genai.Client(api_key="AIzaSyAzKZG28TWtZWMK3edNglzEgWwjvdjVAbA")
output_dir = r"C:\Users\oneok\roadmap-tool\public\images"

prompts = [
    {
        "name": "login-bg",
        "prompt": "Fantasy RPG game title screen background. A grand medieval castle gate at dawn with golden light, adventurer silhouette standing before the gate ready to begin a journey. Dramatic clouds, magical sparkles in the air. Wide cinematic composition, high quality digital art, anime-inspired fantasy style. No text."
    },
    {
        "name": "map-bg",
        "prompt": "Top-down fantasy RPG world map background. A parchment-style adventure map with winding paths connecting different locations through forests, mountains, rivers, and villages. Warm golden tones, illustrated fantasy cartography style with decorative borders. No text, no labels."
    },
    {
        "name": "stage-1",
        "prompt": "Fantasy RPG location icon: A peaceful starting village with a wooden signpost and green hills. Circular frame, game UI icon style, vibrant colors, detailed pixel-perfect digital art. Transparent-style background, isolated element."
    },
    {
        "name": "stage-2",
        "prompt": "Fantasy RPG location icon: An enchanted forest with glowing mushrooms and fairy lights. Circular frame, game UI icon style, vibrant colors, mystical atmosphere. Transparent-style background, isolated element."
    },
    {
        "name": "stage-3",
        "prompt": "Fantasy RPG location icon: A dark mysterious cave entrance with crystals glowing inside. Circular frame, game UI icon style, vibrant purple and blue colors. Transparent-style background, isolated element."
    },
    {
        "name": "stage-4",
        "prompt": "Fantasy RPG location icon: A medieval marketplace town with colorful banners and bustling energy. Circular frame, game UI icon style, warm vibrant colors. Transparent-style background, isolated element."
    },
    {
        "name": "stage-5",
        "prompt": "Fantasy RPG location icon: A tall wizard tower on a cliff with lightning and magical energy. Circular frame, game UI icon style, dramatic blue and purple colors. Transparent-style background, isolated element."
    },
    {
        "name": "stage-6",
        "prompt": "Fantasy RPG location icon: A volcanic mountain fortress with lava flows and fire. Circular frame, game UI icon style, red and orange dramatic colors. Transparent-style background, isolated element."
    },
    {
        "name": "stage-7",
        "prompt": "Fantasy RPG location icon: A majestic golden castle in the clouds, the final destination, heavenly light beaming down. Circular frame, game UI icon style, gold and white radiant colors. Transparent-style background, isolated element."
    },
    {
        "name": "locked-stage",
        "prompt": "Fantasy RPG locked location icon: A mysterious location hidden behind thick fog and chains with a large iron padlock. Dark and grey tones, circular frame, game UI icon style. Transparent-style background."
    },
    {
        "name": "quest-complete",
        "prompt": "Fantasy RPG victory celebration effect: Golden light burst with sparkles, floating stars and treasure chest opening with glowing items. Game UI celebration effect, vibrant gold and warm colors. Transparent-style background."
    },
    {
        "name": "hero-avatar",
        "prompt": "Cute chibi fantasy RPG hero character, young adventurer with a sword and shield, friendly smile, anime style, full body standing pose. Simple clean design suitable for game UI avatar. Transparent-style background."
    },
]

for item in prompts:
    print(f"Generating: {item['name']}...")
    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-image-preview",
            contents=item["prompt"],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                filepath = os.path.join(output_dir, f"{item['name']}.png")
                with open(filepath, "wb") as f:
                    f.write(part.inline_data.data)
                print(f"  [OK] Saved: {filepath}")
                break
        else:
            print(f"  [X] No image generated for {item['name']}")
            if response.candidates[0].content.parts:
                print(f"     Text: {response.candidates[0].content.parts[0].text[:100]}")
    except Exception as e:
        print(f"  [X] Error: {e}")

print("\n[DONE] All done!")
