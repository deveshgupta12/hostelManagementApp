def calculate_indian_gst(daily_rent: float, days: int = 1, is_long_term_residential: bool = True) -> dict[str, float]:
    """Calculate GST for hostel rent transactions.

    Rule implemented (as requested):
    - 12% GST if daily rent is greater than INR 1000.
    - 0% GST for long-term residential stays at INR 1000/day or below.
    """
    taxable_amount = float(daily_rent) * int(days)

    if daily_rent > 1000:
        rate = 0.12
    elif is_long_term_residential:
        rate = 0.0
    else:
        rate = 0.0

    gst_amount = round(taxable_amount * rate, 2)
    total_amount = round(taxable_amount + gst_amount, 2)

    return {
        "base_amount": round(taxable_amount, 2),
        "gst_rate": round(rate, 2),
        "gst_amount": gst_amount,
        "total_amount": total_amount,
    }
