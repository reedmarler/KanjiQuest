"""Pre-downloads the shared Japanese BERT model at Docker build time.

Without this, the ~1.3GB model would download on every cold container start
instead of once, baked into the image layer.
"""
from style_bert_vits2.constants import Languages
from style_bert_vits2.nlp import bert_models

bert_repo = "ku-nlp/deberta-v2-large-japanese-char-wwm"
bert_models.load_model(Languages.JP, bert_repo)
bert_models.load_tokenizer(Languages.JP, bert_repo)
print("BERT model cached.")
