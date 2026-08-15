import streamlit as st
import google.generativeai as genai
from PIL import Image
import os

# -----------------------------------------------------------------------------
# 1. Configuration & Setup
# -----------------------------------------------------------------------------
# In a production MNC environment, we load credentials securely. 
# For local testing, set this in your terminal: export GEMINI_API_KEY="your_key"
API_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)
# Using Gemini 3.6 Flash as it is lightning fast for both text and image processing
MODEL_NAME = 'gemini-3.6-flash' 

# -----------------------------------------------------------------------------
# 2. Core Logic Engine
# -----------------------------------------------------------------------------
def analyze_meal(input_data, is_image=False):
    """
    Sends the text or image to the model with strict prompt instructions.
    """
    model = genai.GenerativeModel(MODEL_NAME)
    
    # Strict prompt engineering to ensure it ONLY outputs calories and focuses on Indian Cuisine
    system_prompt = """
    You are an expert algorithmic calorie counter specializing in Indian Cuisine. 
    Analyze the provided food (either by image or text description).
    
    Strict Rules:
    1. Calculate the total calories.
    2. Account for hidden calories typical in Indian cooking (e.g., ghee, oil, coconut).
    3. Output ONLY the total calories and a brief itemized breakdown.
    4. Do not provide any greetings, dietary advice, or extra conversation.
    
    Required Output Format:
    Total Calories: [X] kcal
    - [Item 1]: [X] kcal
    - [Item 2]: [X] kcal
    """
    
    try:
        if is_image:
            # Multimodal request: Image + Prompt
            response = model.generate_content([system_prompt, input_data])
        else:
            # Text request: User description + Prompt
            text_payload = f"User meal description: {input_data}"
            response = model.generate_content([system_prompt, text_payload])
            
        return response.text
    except Exception as e:
        return f"System Error: {str(e)}"

# -----------------------------------------------------------------------------
# 3. Streamlit User Interface
# -----------------------------------------------------------------------------
def main():
    st.set_page_config(page_title="Indian Diet Calorie Tracker", page_icon="🍛", layout="centered")
    
    st.title("🍛 Indian Cuisine Calorie Tracker")
    st.write("Scan your food, upload a photo, or type what you ate to get an instant calorie count.")
    
    # UI Tabs for the three requested input methods
    tab1, tab2, tab3 = st.tabs(["📸 Scan Food", "📁 Upload Image", "✍️ Describe Meal"])
    
    # Method 1: Scan Food (Uses Device Camera)
    with tab1:
        camera_photo = st.camera_input("Take a picture of your meal")
        if camera_photo is not None:
            img = Image.open(camera_photo)
         # Method 1: Scan Food (Uses Device Camera)
    with tab1:
       with tab1:
        camera_photo = st.camera_input("Take a picture of your meal", key="camera_1")
        if camera_photo is not None:
            img = Image.open(camera_photo)
        if camera_photo is not None:
            img = Image.open(camera_photo)
            st.image(img, caption="Scanned Meal", use_container_width=True)
            
            if st.button("Calculate Calories", key="btn_scan"):
                with st.spinner("Analyzing spices and ingredients..."):
                    result = analyze_meal(img, is_image=True)
                    st.success(result)
            
            if st.button("Calculate Calories", key="btn_scan"):
                with st.spinner("Analyzing spices and ingredients..."):
                    result = analyze_meal(img, is_image=True)
                    st.success(result)

# Method 2: Upload Image
    with tab2:
        uploaded_file = st.file_uploader("Upload an image of your meal", type=["jpg", "jpeg", "png"])
        if uploaded_file is not None:
            img = Image.open(uploaded_file)
            st.image(img, caption="Uploaded Meal", use_container_width=True)
            
            if st.button("Calculate Calories", key="btn_upload"):
                with st.spinner("Analyzing spices and ingredients..."):
                    result = analyze_meal(img, is_image=True)
                    st.success(result)

    # Method 3: Describe Meal (Text Input)
    with tab3:
        meal_description = st.text_input("Describe your meal", placeholder="e.g., 2 Idlis and Coconut chutney")
        
        if st.button("Calculate Calories", key="btn_text"):
            if meal_description.strip() == "":
                st.warning("Please enter a meal description.")
            else:
                with st.spinner("Calculating..."):
                    result = analyze_meal(meal_description, is_image=False)
                    st.success(result)

if __name__ == "__main__":
    main()
