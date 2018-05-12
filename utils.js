module.exports = function()
{
    this.ZONE_BOOK_LIST_KEY_PREFIX = "ZONE_BOOK_LIST_";
    this.BOOK_ZONE_KEY_PREFIX = "BOOK_ZONE_";
    
    this.normalizeParcelNumber = function(parcel_num)
    {
        if ( parcel_num == null ) return null;

        var sanitized_parcel = parcel_num.replace('-', '');
        while ( sanitized_parcel.indexOf('-') >= 0 )
        {
            sanitized_parcel = sanitized_parcel.replace('-', ''); // Search ignores hyphens
        }
        sanitized_parcel = sanitized_parcel.toUpperCase(); // Search ignores case

        return sanitized_parcel;
    }
}